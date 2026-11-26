const express = require('express');
const InsuranceClaim = require('../models/InsuranceClaim');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /api/analytics/dashboard
router.get('/dashboard', authenticate, async (req, res, next) => {
  try {
    const { dateFrom, dateTo } = req.query;
    const matchQuery = {};

    if (req.user.role !== 'investigator') {
      matchQuery.customerId = req.user._id;
    }

    if (dateFrom || dateTo) {
      matchQuery.createdAt = {};
      if (dateFrom) matchQuery.createdAt.$gte = new Date(dateFrom);
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        matchQuery.createdAt.$lte = end;
      }
    }

    const claims = await InsuranceClaim.find(matchQuery)
      .populate('latestAnalysisId')
      .sort({ createdAt: -1 });

    const totalClaims = claims.length;
    const authenticClaims = claims.filter((c) => c.aiPrediction === 'AUTHENTIC').length;
    const suspiciousClaims = claims.filter((c) => c.aiPrediction === 'SUSPICIOUS').length;
    const pendingAnalysisClaims = claims.filter((c) => c.aiPrediction === 'PENDING').length;

    const pendingReviews = claims.filter((c) =>
      ['Pending Review', 'Flagged for Manual Investigation', 'Manual Verification Requested', 'Pending Analysis'].includes(
        c.investigationStatus
      )
    ).length;
    const approvedClaims = claims.filter((c) => c.investigationStatus === 'Approved').length;
    const rejectedClaims = claims.filter((c) => c.investigationStatus === 'Rejected').length;
    const manualVerificationClaims = claims.filter(
      (c) =>
        c.investigationStatus === 'Manual Verification Requested' ||
        c.investigationStatus === 'Flagged for Manual Investigation'
    ).length;

    const scoredClaims = claims.filter((c) => typeof c.confidenceScore === 'number');
    const averageConfidence = scoredClaims.length
      ? Number(
          (
            scoredClaims.reduce((acc, c) => acc + c.confidenceScore, 0) / scoredClaims.length
          ).toFixed(1)
        )
      : 0;

    const demoDataCount = claims.filter((c) => c.isDemoData).length;

    const authenticityDistribution = [
      { name: 'Authentic', value: authenticClaims, color: '#10b981' },
      { name: 'Suspicious', value: suspiciousClaims, color: '#ef4444' },
      ...(pendingAnalysisClaims > 0
        ? [{ name: 'Pending Analysis', value: pendingAnalysisClaims, color: '#94a3b8' }]
        : []),
    ];

    // Monthly grouping sorted chronologically
    const monthBuckets = new Map();
    for (const claim of claims) {
      const dt = new Date(claim.createdAt);
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
      const label = dt.toLocaleString('en-US', { month: 'short', year: '2-digit' });
      if (!monthBuckets.has(key)) {
        monthBuckets.set(key, {
          key,
          month: label,
          total: 0,
          authentic: 0,
          suspicious: 0,
        });
      }
      const bucket = monthBuckets.get(key);
      bucket.total += 1;
      if (claim.aiPrediction === 'AUTHENTIC') bucket.authentic += 1;
      if (claim.aiPrediction === 'SUSPICIOUS') bucket.suspicious += 1;
    }

    const monthlySubmissions = Array.from(monthBuckets.values()).sort((a, b) =>
      a.key.localeCompare(b.key)
    );

    const fraudTrend = monthlySubmissions.map((m) => ({
      month: m.month,
      suspiciousRate: m.total > 0 ? Number(((m.suspicious / m.total) * 100).toFixed(1)) : 0,
      suspiciousCount: m.suspicious,
      authenticCount: m.authentic,
    }));

    const statusCounts = {};
    for (const claim of claims) {
      statusCounts[claim.investigationStatus] = (statusCounts[claim.investigationStatus] || 0) + 1;
    }
    const statusDistribution = Object.entries(statusCounts).map(([status, count]) => ({
      status,
      count,
    }));

    return res.json({
      summary: {
        totalClaims,
        authenticClaims,
        suspiciousClaims,
        pendingReviews,
        approvedClaims,
        rejectedClaims,
        manualVerificationClaims,
        pendingAnalysisClaims,
        averageConfidence,
        demoDataCount,
      },
      hasDemoData: demoDataCount > 0,
      authenticityDistribution,
      monthlySubmissions,
      fraudTrend,
      statusDistribution,
      recentClaims: claims.slice(0, 6),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
