const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const InsuranceClaim = require('../models/InsuranceClaim');
const AnalysisResult = require('../models/AnalysisResult');
const InvestigationRecord = require('../models/InvestigationRecord');
const { UPLOAD_ROOT } = require('../middleware/upload');

/**
 * Generates a valid PNG image buffer in pure Node.js (no external binary dependency)
 * so seeded demo claims have real previewable image files on disk.
 */
function createSamplePng(width, height, bgColor, accentColor) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function crc32(buf) {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      crc ^= buf[i];
      for (let j = 0; j < 8; j++) {
        crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
      }
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const rawRows = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + width * 3);
    rawRows[rowStart] = 0; // filter none
    for (let x = 0; x < width; x++) {
      const px = rowStart + 1 + x * 3;
      const inVehicleBody = x > 60 && x < width - 60 && y > 90 && y < height - 60;
      const inDamagePatch = x > width * 0.56 && x < width * 0.8 && y > height * 0.42 && y < height * 0.72;
      const inWheel =
        Math.hypot(x - 125, y - (height - 65)) < 32 ||
        Math.hypot(x - (width - 125), y - (height - 65)) < 32;

      if (inWheel) {
        rawRows[px] = 25;
        rawRows[px + 1] = 32;
        rawRows[px + 2] = 44;
      } else if (inDamagePatch) {
        rawRows[px] = accentColor[0];
        rawRows[px + 1] = accentColor[1];
        rawRows[px + 2] = accentColor[2];
      } else if (inVehicleBody) {
        rawRows[px] = bgColor[0];
        rawRows[px + 1] = bgColor[1];
        rawRows[px + 2] = bgColor[2];
      } else {
        rawRows[px] = 226;
        rawRows[px + 1] = 234;
        rawRows[px + 2] = 244;
      }
    }
  }

  const idat = zlib.deflateSync(rawRows);
  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', idat),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

async function seedDemoData() {
  const existingUsers = await User.countDocuments();
  if (existingUsers > 0) {
    return;
  }

  console.log('[Seed] Seeding initial demo users and sample insurance claims...');

  const demoDir = path.join(UPLOAD_ROOT, 'demo');
  fs.mkdirSync(demoDir, { recursive: true });

  const sampleImg1 = path.join(demoDir, 'sample_authentic_front.png');
  const sampleImg2 = path.join(demoDir, 'sample_suspicious_side.png');
  const sampleImg3 = path.join(demoDir, 'sample_authentic_rear.png');
  const sampleImg4 = path.join(demoDir, 'sample_suspicious_bumper.png');

  fs.writeFileSync(sampleImg1, createSamplePng(480, 300, [30, 64, 120], [180, 80, 70]));
  fs.writeFileSync(sampleImg2, createSamplePng(480, 300, [52, 74, 108], [220, 50, 50]));
  fs.writeFileSync(sampleImg3, createSamplePng(480, 300, [40, 84, 130], [160, 95, 80]));
  fs.writeFileSync(sampleImg4, createSamplePng(480, 300, [68, 92, 132], [235, 45, 65]));

  const customerHash = await bcrypt.hash('Customer@123', 10);
  const investigatorHash = await bcrypt.hash('Investigator@123', 10);

  const customer = await User.create({
    name: 'Aarav Sharma',
    email: 'customer@insureguard.ai',
    passwordHash: customerHash,
    role: 'customer',
    phone: '+1 (555) 234-8910',
    policyNumber: 'POL-VEH-2026-8841',
  });

  const investigator = await User.create({
    name: 'Elena Vance',
    email: 'investigator@insureguard.ai',
    passwordHash: investigatorHash,
    role: 'investigator',
    phone: '+1 (555) 908-4412',
    department: 'Special Investigations Unit (SIU)',
  });

  const now = new Date();
  const monthsAgo = (m) => {
    const d = new Date(now);
    d.setMonth(d.getMonth() - m);
    return d;
  };

  const demoSpecs = [
    {
      claimNumber: 'CLM-2026-0914-DEMO',
      vehicleRegistrationNumber: 'KA-01-MJ-4821',
      vehicleModel: '2023 Hyundai Tucson SEL',
      accidentDate: monthsAgo(3),
      createdAt: monthsAgo(3),
      accidentLocation: 'MG Road Intersection, Downtown',
      accidentDescription: 'Minor low-speed front bumper impact at traffic signal.',
      damageType: 'Front Bumper / Grille',
      imagePath: sampleImg1,
      imageUrl: '/uploads/demo/sample_authentic_front.png',
      imageOriginalName: 'sample_authentic_front.png',
      prediction: 'AUTHENTIC',
      confidence: 91.4,
      authenticProbability: 91.4,
      suspiciousProbability: 8.6,
      investigationStatus: 'Approved',
      findings: [
        'Sample demo record: Consistent camera noise pattern and natural edge gradients.',
        'Camera EXIF metadata simulated in sample record.',
      ],
      investigatorAction: {
        action: 'Approve Claim',
        remarks: 'Sample demo review: Physical repair estimate aligns with front grille photo.',
      },
    },
    {
      claimNumber: 'CLM-2026-0942-DEMO',
      vehicleRegistrationNumber: 'MH-12-TR-7730',
      vehicleModel: '2024 Honda Civic Touring',
      accidentDate: monthsAgo(2),
      createdAt: monthsAgo(2),
      accidentLocation: 'Expressway Exit 14',
      accidentDescription: 'Side door dent reported after parking lot scrape.',
      damageType: 'Side Door / Panel',
      imagePath: sampleImg2,
      imageUrl: '/uploads/demo/sample_suspicious_side.png',
      imageOriginalName: 'sample_suspicious_side.png',
      prediction: 'SUSPICIOUS',
      confidence: 88.5,
      authenticProbability: 11.5,
      suspiciousProbability: 88.5,
      investigationStatus: 'Rejected',
      findings: [
        'Sample demo record: Elevated ELA variance around damaged side panel.',
        'Sample demo record: Missing original camera EXIF metadata.',
      ],
      investigatorAction: {
        action: 'Reject Claim',
        remarks: 'Sample demo review: In-person garage inspection showed no corresponding panel damage.',
      },
    },
    {
      claimNumber: 'CLM-2026-0978-DEMO',
      vehicleRegistrationNumber: 'DL-04-CA-1192',
      vehicleModel: '2022 Toyota RAV4 Hybrid',
      accidentDate: monthsAgo(1),
      createdAt: monthsAgo(1),
      accidentLocation: 'Ring Road Southbound',
      accidentDescription: 'Rear tailgate indentation from backing into bollard.',
      damageType: 'Rear Collision',
      imagePath: sampleImg3,
      imageUrl: '/uploads/demo/sample_authentic_rear.png',
      imageOriginalName: 'sample_authentic_rear.png',
      prediction: 'AUTHENTIC',
      confidence: 86.2,
      authenticProbability: 86.2,
      suspiciousProbability: 13.8,
      investigationStatus: 'Pending Review',
      findings: [
        'Sample demo record: Patch texture consistency falls within expected photographic bounds.',
      ],
    },
    {
      claimNumber: 'CLM-2026-1005-DEMO',
      vehicleRegistrationNumber: 'TX-889-KLM',
      vehicleModel: '2024 Tesla Model 3',
      accidentDate: monthsAgo(0),
      createdAt: monthsAgo(0),
      accidentLocation: 'North Loop Highway',
      accidentDescription: 'Severe front fender crease claimed after highway debris strike.',
      damageType: 'Hood / Fender',
      imagePath: sampleImg4,
      imageUrl: '/uploads/demo/sample_suspicious_bumper.png',
      imageOriginalName: 'sample_suspicious_bumper.png',
      prediction: 'SUSPICIOUS',
      confidence: 94.5,
      authenticProbability: 5.5,
      suspiciousProbability: 94.5,
      investigationStatus: 'Flagged for Manual Investigation',
      findings: [
        'Sample demo record: Synthetic texture smoothness and missing camera EXIF.',
        'Sample demo record: High compression residual discrepancy around damaged fender.',
      ],
    },
  ];

  for (const spec of demoSpecs) {
    const stat = fs.statSync(spec.imagePath);
    const claim = await InsuranceClaim.create({
      claimNumber: spec.claimNumber,
      customerId: customer._id,
      customerName: customer.name,
      policyNumber: customer.policyNumber,
      vehicleRegistrationNumber: spec.vehicleRegistrationNumber,
      vehicleModel: spec.vehicleModel,
      accidentDate: spec.accidentDate,
      accidentLocation: spec.accidentLocation,
      accidentDescription: spec.accidentDescription,
      damageType: spec.damageType,
      imagePath: spec.imagePath,
      imageUrl: spec.imageUrl,
      imageOriginalName: spec.imageOriginalName,
      imageMimeType: 'image/png',
      imageSizeBytes: stat.size,
      aiPrediction: spec.prediction,
      confidenceScore: spec.confidence,
      investigationStatus: spec.investigationStatus,
      isDemoData: true,
      createdAt: spec.createdAt,
      updatedAt: spec.createdAt,
    });

    const analysis = await AnalysisResult.create({
      claimId: claim._id,
      prediction: spec.prediction,
      confidence: spec.confidence,
      authenticProbability: spec.authenticProbability,
      suspiciousProbability: spec.suspiciousProbability,
      modelStatus: 'demo_mode',
      isDemoPrediction: true,
      modelArchitecture: 'Sample Seeded Demo Record (Not Live CNN Output)',
      disclaimer:
        'SAMPLE DEMO DATA: Seeded illustrative record for platform evaluation. Upload a real image to run live forensic analysis.',
      analysisDetails: {
        image_quality: {
          filename: spec.imageOriginalName,
          format: 'PNG',
          width: 480,
          height: 300,
          file_size_kb: Number((stat.size / 1024).toFixed(2)),
          sharpness_score: spec.prediction === 'AUTHENTIC' ? 142.5 : 41.2,
          assessment: 'Sample Demo Asset',
        },
        texture_consistency: {
          patch_variance_cv: spec.prediction === 'AUTHENTIC' ? 0.94 : 2.68,
          anomaly_flagged: spec.prediction === 'SUSPICIOUS',
          assessment:
            spec.prediction === 'SUSPICIOUS'
              ? 'Sample indicator: Uneven local texture variance'
              : 'Sample indicator: Natural spatial texture variance',
        },
        noise_pattern: {
          ela_mean_error: spec.prediction === 'AUTHENTIC' ? 2.1 : 8.7,
          ela_std_error: spec.prediction === 'AUTHENTIC' ? 3.2 : 11.4,
          residual_noise_std: spec.prediction === 'AUTHENTIC' ? 2.4 : 0.75,
          anomaly_flagged: spec.prediction === 'SUSPICIOUS',
          assessment:
            spec.prediction === 'SUSPICIOUS'
              ? 'Sample indicator: Elevated ELA residual discrepancy'
              : 'Sample indicator: Consistent sensor-like noise residual',
        },
        edge_artifacts: {
          canny_edge_density: spec.prediction === 'AUTHENTIC' ? 0.082 : 0.245,
          anomaly_flagged: spec.prediction === 'SUSPICIOUS',
          assessment:
            spec.prediction === 'SUSPICIOUS'
              ? 'Sample indicator: Sharp boundary discontinuities'
              : 'Sample indicator: Expected photographic edge distribution',
        },
        structural_irregularities: {
          block_boundary_ratio: spec.prediction === 'AUTHENTIC' ? 1.02 : 1.39,
          anomaly_flagged: spec.prediction === 'SUSPICIOUS',
          assessment:
            spec.prediction === 'SUSPICIOUS'
              ? 'Sample indicator: Discontinuous block alignment'
              : 'Sample indicator: Uniform block alignment',
        },
        ai_generation_suspicion: {
          heuristic_risk_score: spec.suspiciousProbability,
          risk_level: spec.prediction === 'SUSPICIOUS' ? 'High' : 'Low',
          note: 'Sample seeded demo record.',
        },
        metadata: {
          exif_present: spec.prediction === 'AUTHENTIC',
          has_camera_signature: spec.prediction === 'AUTHENTIC',
          editing_or_ai_software_detected: false,
          camera_make: spec.prediction === 'AUTHENTIC' ? 'Sample Camera' : null,
          camera_model: spec.prediction === 'AUTHENTIC' ? 'Demo Sensor' : null,
        },
        summary_findings: spec.findings,
      },
      analyzedAt: spec.createdAt,
    });

    claim.latestAnalysisId = analysis._id;
    await claim.save();

    if (spec.investigatorAction) {
      await InvestigationRecord.create({
        claimId: claim._id,
        investigatorId: investigator._id,
        investigatorName: investigator.name,
        action: spec.investigatorAction.action,
        previousStatus:
          spec.prediction === 'SUSPICIOUS' ? 'Flagged for Manual Investigation' : 'Pending Review',
        newStatus: spec.investigationStatus,
        remarks: spec.investigatorAction.remarks,
        reviewedAt: spec.createdAt,
      });
    }
  }

  console.log('[Seed] Demo users and 4 sample claims seeded.');
}

if (require.main === module) {
  require('dotenv').config();
  const { connectDatabase, disconnectDatabase } = require('../config/db');
  connectDatabase()
    .then(() => seedDemoData())
    .then(() => disconnectDatabase())
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { seedDemoData };
