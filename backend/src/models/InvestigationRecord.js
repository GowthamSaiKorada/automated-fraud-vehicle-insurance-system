const mongoose = require('mongoose');

const investigationRecordSchema = new mongoose.Schema(
  {
    claimId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InsuranceClaim',
      required: true,
      index: true,
    },
    investigatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    investigatorName: {
      type: String,
      required: true,
    },
    action: {
      type: String,
      enum: ['Approve Claim', 'Reject Claim', 'Request Manual Verification'],
      required: true,
    },
    previousStatus: {
      type: String,
      required: true,
    },
    newStatus: {
      type: String,
      required: true,
    },
    remarks: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1500,
    },
    reviewedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    collection: 'InvestigationRecords',
  }
);

module.exports = mongoose.model('InvestigationRecord', investigationRecordSchema);
