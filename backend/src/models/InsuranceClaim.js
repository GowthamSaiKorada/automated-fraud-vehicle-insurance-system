const mongoose = require('mongoose');

const insuranceClaimSchema = new mongoose.Schema(
  {
    claimNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    customerName: {
      type: String,
      required: true,
      trim: true,
    },
    policyNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    vehicleRegistrationNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    vehicleModel: {
      type: String,
      required: true,
      trim: true,
    },
    accidentDate: {
      type: Date,
      required: true,
    },
    accidentLocation: {
      type: String,
      required: true,
      trim: true,
    },
    accidentDescription: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    damageType: {
      type: String,
      required: true,
      enum: [
        'Front Bumper / Grille',
        'Rear Collision',
        'Side Door / Panel',
        'Windshield / Glass',
        'Hood / Fender',
        'Multi-Panel Impact',
        'Other',
      ],
    },
    imagePath: {
      type: String,
      required: true,
    },
    imageUrl: {
      type: String,
      required: true,
    },
    imageOriginalName: {
      type: String,
      required: true,
    },
    imageMimeType: {
      type: String,
      required: true,
    },
    imageSizeBytes: {
      type: Number,
      required: true,
    },
    aiPrediction: {
      type: String,
      enum: ['PENDING', 'AUTHENTIC', 'SUSPICIOUS'],
      default: 'PENDING',
      index: true,
    },
    confidenceScore: {
      type: Number,
      default: null,
      min: 0,
      max: 100,
    },
    investigationStatus: {
      type: String,
      enum: [
        'Pending Analysis',
        'Pending Review',
        'Flagged for Manual Investigation',
        'Manual Verification Requested',
        'Approved',
        'Rejected',
      ],
      default: 'Pending Analysis',
      index: true,
    },
    latestAnalysisId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AnalysisResult',
      default: null,
    },
    isDemoData: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    collection: 'InsuranceClaims',
  }
);

module.exports = mongoose.model('InsuranceClaim', insuranceClaimSchema);
