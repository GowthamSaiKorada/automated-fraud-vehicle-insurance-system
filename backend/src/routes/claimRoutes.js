const fs = require('fs');
const path = require('path');
const express = require('express');
const InsuranceClaim = require('../models/InsuranceClaim');
const AnalysisResult = require('../models/AnalysisResult');
const InvestigationRecord = require('../models/InvestigationRecord');
const { authenticate, requireRole } = require('../middleware/auth');
const {
  CLAIMS_UPLOAD_DIR,
  uploadMiddleware,
  verifyImageMagicBytes,
} = require('../middleware/upload');
const { analyzeClaimImage, detectVehicleDamage } = require('../services/aiServiceClient');

const router = express.Router();

const ALLOWED_DAMAGE_TYPES = new Set([
  'Front Bumper / Grille',
  'Rear Collision',
  'Side Door / Panel',
  'Windshield / Glass',
  'Hood / Fender',
  'Multi-Panel Impact',
  'Other',
]);

async function generateClaimNumber() {
  const year = new Date().getFullYear();
  const count = await InsuranceClaim.countDocuments();
  const randomSuffix = Math.floor(100 + Math.random() * 900);
  return `CLM-${year}-${String(count + 1001).padStart(4, '0')}-${randomSuffix}`;
}

function resolveSafeClaimImagePath(storedPath) {
  const resolved = path.resolve(storedPath);
  const allowedBase = path.resolve(CLAIMS_UPLOAD_DIR);
  const demoBase = path.resolve(path.dirname(CLAIMS_UPLOAD_DIR), 'demo');
  if (
    !resolved.startsWith(allowedBase + path.sep) &&
    !resolved.startsWith(demoBase + path.sep)
  ) {
    return null;
  }
  return resolved;
}

// POST /api/claims/upload-image
router.post('/upload-image', authenticate, (req, res) => {
  uploadMiddleware.single('image')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message || 'Image upload failed.' });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'Please attach a JPG, JPEG, or PNG image file.' });
    }

    const isValidImage = verifyImageMagicBytes(req.file.path);
    if (!isValidImage) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({
        message: 'Uploaded file signature does not match a valid JPEG or PNG image.',
      });
    }

    const imageUrl = `/uploads/claims/${req.file.filename}`;
    return res.status(201).json({
      message: 'Image uploaded successfully.',
      imagePath: req.file.path,
      imageUrl,
      imageOriginalName: req.file.originalname,
      imageMimeType: req.file.mimetype,
      imageSizeBytes: req.file.size,
    });
  });
});

// POST /api/claims
router.post('/', authenticate, async (req, res, next) => {
  try {
    const {
      customerName,
      policyNumber,
      vehicleRegistrationNumber,
      vehicleModel,
      accidentDate,
      accidentLocation,
      accidentDescription,
      damageType,
      imagePath,
      imageUrl,
      imageOriginalName,
      imageMimeType,
      imageSizeBytes,
    } = req.body;

    if (
      !customerName ||
      !policyNumber ||
      !vehicleRegistrationNumber ||
      !vehicleModel ||
      !accidentDate ||
      !accidentLocation ||
      !accidentDescription ||
      !damageType
    ) {
      return res.status(400).json({ message: 'All claim details fields are required.' });
    }

    if (!ALLOWED_DAMAGE_TYPES.has(damageType)) {
      return res.status(400).json({ message: 'Invalid damage type selected.' });
    }

    if (!imagePath || !imageUrl) {
      return res.status(400).json({ message: 'Please upload a vehicle accident image first.' });
    }

    const safePath = resolveSafeClaimImagePath(imagePath);
    if (!safePath || !fs.existsSync(safePath)) {
      return res.status(400).json({ message: 'Uploaded image reference is invalid or missing on server.' });
    }

    const parsedDate = new Date(accidentDate);
    if (Number.isNaN(parsedDate.getTime())) {
      return res.status(400).json({ message: 'Invalid accident date provided.' });
    }

    const claimNumber = await generateClaimNumber();

    const claim = await InsuranceClaim.create({
      claimNumber,
      customerId: req.user._id,
      customerName: String(customerName).trim(),
      policyNumber: String(policyNumber).trim().toUpperCase(),
      vehicleRegistrationNumber: String(vehicleRegistrationNumber).trim().toUpperCase(),
      vehicleModel: String(vehicleModel).trim(),
      accidentDate: parsedDate,
      accidentLocation: String(accidentLocation).trim(),
      accidentDescription: String(accidentDescription).trim(),
      damageType,
      imagePath: safePath,
      imageUrl: String(imageUrl),
      imageOriginalName: String(imageOriginalName || path.basename(safePath)),
      imageMimeType: String(imageMimeType || 'image/jpeg'),
      imageSizeBytes: Number(imageSizeBytes) || fs.statSync(safePath).size,
      aiPrediction: 'PENDING',
      investigationStatus: 'Pending Analysis',
      isDemoData: false,
    });

    return res.status(201).json({
      message: 'Insurance claim submitted successfully.',
      claim,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/claims/:id/analyze
router.post('/:id/analyze', authenticate, async (req, res, next) => {
  try {
    const claim = await InsuranceClaim.findById(req.params.id);
    if (!claim) {
      return res.status(404).json({ message: 'Claim not found.' });
    }

    if (req.user.role !== 'investigator' && claim.customerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You are not authorized to analyze this claim.' });
    }

    const safePath = resolveSafeClaimImagePath(claim.imagePath);
    if (!safePath || !fs.existsSync(safePath)) {
      return res.status(404).json({ message: 'Claim image file could not be found on disk.' });
    }

    const aiResponse = await analyzeClaimImage(safePath, claim.imageOriginalName, claim.imageMimeType);
    const damageResponse = req.query.detectDamage === 'true'
      ? await detectVehicleDamage(safePath, claim.imageOriginalName, claim.imageMimeType)
      : null;

    const analysisDoc = await AnalysisResult.create({
      claimId: claim._id,
      prediction: aiResponse.prediction,
      confidence: aiResponse.confidence,
      authenticProbability: aiResponse.authentic_probability,
      suspiciousProbability: aiResponse.suspicious_probability,
      modelStatus: aiResponse.model_status,
      isDemoPrediction: Boolean(aiResponse.is_demo_prediction),
      modelArchitecture: aiResponse.model_architecture || '',
      disclaimer: aiResponse.disclaimer || '',
      analysisDetails: aiResponse.analysis_details || {},
      damageDetection: damageResponse,
      analyzedAt: new Date(),
    });

    claim.aiPrediction = aiResponse.prediction;
    claim.confidenceScore = aiResponse.confidence;
    claim.latestAnalysisId = analysisDoc._id;
    claim.investigationStatus =
      aiResponse.prediction === 'SUSPICIOUS'
        ? 'Flagged for Manual Investigation'
        : 'Pending Review';
    await claim.save();

    return res.json({
      message: 'AI image authenticity analysis completed.',
      claim,
      analysisResult: analysisDoc,
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ message: err.message });
    }
    next(err);
  }
});

// GET /api/claims/my
router.get('/my', authenticate, async (req, res, next) => {
  try {
    const { search, aiPrediction, investigationStatus } = req.query;
    const query = { customerId: req.user._id };

    if (aiPrediction && aiPrediction !== 'ALL') {
      query.aiPrediction = aiPrediction;
    }
    if (investigationStatus && investigationStatus !== 'ALL') {
      query.investigationStatus = investigationStatus;
    }
    if (search && String(search).trim()) {
      const regex = new RegExp(String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [
        { claimNumber: regex },
        { vehicleRegistrationNumber: regex },
        { vehicleModel: regex },
        { policyNumber: regex },
      ];
    }

    const claims = await InsuranceClaim.find(query)
      .populate('latestAnalysisId')
      .sort({ createdAt: -1 });

    return res.json({ claims });
  } catch (err) {
    next(err);
  }
});

// GET /api/claims (Investigator only)
router.get('/', authenticate, requireRole('investigator'), async (req, res, next) => {
  try {
    const {
      search,
      dateFrom,
      dateTo,
      aiPrediction,
      investigationStatus,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const query = {};

    if (aiPrediction && aiPrediction !== 'ALL') {
      query.aiPrediction = aiPrediction;
    }
    if (investigationStatus && investigationStatus !== 'ALL') {
      query.investigationStatus = investigationStatus;
    }
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }
    if (search && String(search).trim()) {
      const regex = new RegExp(String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [
        { claimNumber: regex },
        { customerName: regex },
        { policyNumber: regex },
        { vehicleRegistrationNumber: regex },
        { vehicleModel: regex },
        { accidentLocation: regex },
      ];
    }

    const allowedSortFields = new Set(['createdAt', 'confidenceScore', 'accidentDate']);
    const sortField = allowedSortFields.has(sortBy) ? sortBy : 'createdAt';
    const order = sortOrder === 'asc' ? 1 : -1;

    const claims = await InsuranceClaim.find(query)
      .populate('latestAnalysisId')
      .sort({ [sortField]: order, createdAt: -1 });

    return res.json({ claims });
  } catch (err) {
    next(err);
  }
});

// GET /api/claims/:id
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const claim = await InsuranceClaim.findById(req.params.id).populate('latestAnalysisId');
    if (!claim) {
      return res.status(404).json({ message: 'Claim not found.' });
    }

    if (req.user.role !== 'investigator' && claim.customerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied to this claim record.' });
    }

    const investigationHistory = await InvestigationRecord.find({ claimId: claim._id }).sort({
      reviewedAt: -1,
    });

    return res.json({
      claim,
      analysisResult: claim.latestAnalysisId || null,
      investigationHistory,
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/claims/:id/investigate (Investigator only)
router.patch('/:id/investigate', authenticate, requireRole('investigator'), async (req, res, next) => {
  try {
    const { action, remarks } = req.body;
    const actionStatusMap = {
      'Approve Claim': 'Approved',
      'Reject Claim': 'Rejected',
      'Request Manual Verification': 'Manual Verification Requested',
    };

    const newStatus = actionStatusMap[action];
    if (!newStatus) {
      return res.status(400).json({
        message: 'Invalid investigation action. Must be Approve Claim, Reject Claim, or Request Manual Verification.',
      });
    }

    if (!remarks || String(remarks).trim().length < 3) {
      return res.status(400).json({
        message: 'Investigator remarks (at least 3 characters) are required to record a decision.',
      });
    }

    const claim = await InsuranceClaim.findById(req.params.id);
    if (!claim) {
      return res.status(404).json({ message: 'Claim not found.' });
    }

    const previousStatus = claim.investigationStatus;
    claim.investigationStatus = newStatus;
    await claim.save();

    const record = await InvestigationRecord.create({
      claimId: claim._id,
      investigatorId: req.user._id,
      investigatorName: req.user.name,
      action,
      previousStatus,
      newStatus,
      remarks: String(remarks).trim(),
      reviewedAt: new Date(),
    });

    const investigationHistory = await InvestigationRecord.find({ claimId: claim._id }).sort({
      reviewedAt: -1,
    });

    return res.json({
      message: `Claim updated to "${newStatus}".`,
      claim,
      record,
      investigationHistory,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
