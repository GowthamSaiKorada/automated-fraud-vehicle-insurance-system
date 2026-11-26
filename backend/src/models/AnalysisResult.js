const mongoose = require('mongoose');

const analysisResultSchema = new mongoose.Schema(
  {
    claimId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InsuranceClaim',
      required: true,
      index: true,
    },
    prediction: {
      type: String,
      enum: ['AUTHENTIC', 'SUSPICIOUS'],
      required: true,
    },
    confidence: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    authenticProbability: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    suspiciousProbability: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    modelStatus: {
      type: String,
      enum: ['model_loaded', 'demo_mode', 'model_unavailable'],
      required: true,
    },
    isDemoPrediction: {
      type: Boolean,
      required: true,
    },
    modelArchitecture: {
      type: String,
      default: '',
    },
    disclaimer: {
      type: String,
      default: '',
    },
    analysisDetails: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    damageDetection: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    analyzedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    collection: 'AnalysisResults',
  }
);

module.exports = mongoose.model('AnalysisResult', analysisResultSchema);
