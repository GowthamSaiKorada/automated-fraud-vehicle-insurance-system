export type UserRole = 'customer' | 'investigator';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  policyNumber?: string;
  department?: string;
  createdAt?: string;
}

export type AiPredictionType = 'PENDING' | 'AUTHENTIC' | 'SUSPICIOUS';

export type InvestigationStatusType =
  | 'Pending Analysis'
  | 'Pending Review'
  | 'Flagged for Manual Investigation'
  | 'Manual Verification Requested'
  | 'Approved'
  | 'Rejected';

export interface AnalysisDetails {
  image_quality?: {
    filename?: string;
    format?: string;
    color_mode?: string;
    width?: number;
    height?: number;
    megapixels?: number;
    file_size_kb?: number;
    sharpness_score?: number;
    brightness_mean?: number;
    contrast_std?: number;
    assessment?: string;
  };
  texture_consistency?: {
    patch_count_analyzed?: number;
    patch_variance_cv?: number;
    median_patch_energy?: number;
    anomaly_flagged?: boolean;
    assessment?: string;
  };
  noise_pattern?: {
    ela_mean_error?: number;
    ela_std_error?: number;
    ela_max_error?: number;
    residual_noise_std?: number;
    channel_noise_spread?: number;
    anomaly_flagged?: boolean;
    assessment?: string;
  };
  edge_artifacts?: {
    canny_edge_density?: number;
    high_gradient_pixel_ratio?: number;
    anomaly_flagged?: boolean;
    assessment?: string;
  };
  structural_irregularities?: {
    block_boundary_ratio?: number;
    anomaly_flagged?: boolean;
    assessment?: string;
  };
  ai_generation_suspicion?: {
    heuristic_risk_score?: number;
    risk_level?: string;
    signals_triggered?: number;
    note?: string;
  };
  metadata?: {
    exif_present?: boolean;
    tag_count?: number;
    has_camera_signature?: boolean;
    camera_make?: string | null;
    camera_model?: string | null;
    software?: string | null;
    captured_at?: string | null;
    editing_or_ai_software_detected?: boolean;
    matched_software_markers?: string[];
  };
  visual_explanation?: {
    type?: string;
    description?: string;
    heatmap_data_url?: string;
  };
  summary_findings?: string[];
}

export interface DamageDetectionResult {
  model_status: string;
  detections: Array<{
    label: string;
    confidence: number;
    bbox: { x1: number; y1: number; x2: number; y2: number };
  }>;
  detection_count: number;
  message?: string;
}

export interface ModelComparisonItem {
  model_key: string;
  model_name: string;
  status: 'model_loaded' | 'model_unavailable';
  prediction: 'AUTHENTIC' | 'SUSPICIOUS' | null;
  confidence: number | null;
  authentic_probability: number | null;
  suspicious_probability: number | null;
  val_accuracy: number | null;
  architecture?: string;
  decision_strength?: string;
  inference_time_ms?: number | null;
  logit_margin?: number | null;
  reason?: string;
  forensic_flags?: string[];
}

export interface AnalysisResult {
  _id: string;
  claimId: string;
  prediction: 'AUTHENTIC' | 'SUSPICIOUS';
  confidence: number;
  authenticProbability: number;
  suspiciousProbability: number;
  modelStatus: 'model_loaded' | 'demo_mode' | 'model_unavailable';
  isDemoPrediction: boolean;
  modelArchitecture?: string;
  disclaimer?: string;
  analysisDetails?: AnalysisDetails;
  damageDetection?: DamageDetectionResult | null;
  modelComparisons?: ModelComparisonItem[];
  analyzedAt: string;
}

export interface InsuranceClaim {
  _id: string;
  claimNumber: string;
  customerId: string;
  customerName: string;
  policyNumber: string;
  vehicleRegistrationNumber: string;
  vehicleModel: string;
  accidentDate: string;
  accidentLocation: string;
  accidentDescription: string;
  damageType: string;
  imagePath: string;
  imageUrl: string;
  imageOriginalName: string;
  imageMimeType: string;
  imageSizeBytes: number;
  aiPrediction: AiPredictionType;
  confidenceScore: number | null;
  investigationStatus: InvestigationStatusType;
  latestAnalysisId?: AnalysisResult | null;
  isDemoData?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InvestigationRecord {
  _id: string;
  claimId: string;
  investigatorId: string;
  investigatorName: string;
  action: 'Approve Claim' | 'Reject Claim' | 'Request Manual Verification';
  previousStatus: string;
  newStatus: string;
  remarks: string;
  reviewedAt: string;
}

export interface AnalyticsDashboardResponse {
  summary: {
    totalClaims: number;
    authenticClaims: number;
    suspiciousClaims: number;
    pendingReviews: number;
    approvedClaims: number;
    rejectedClaims: number;
    manualVerificationClaims: number;
    pendingAnalysisClaims: number;
    averageConfidence: number;
    demoDataCount: number;
  };
  hasDemoData: boolean;
  authenticityDistribution: Array<{ name: string; value: number; color: string }>;
  monthlySubmissions: Array<{ month: string; total: number; authentic: number; suspicious: number }>;
  fraudTrend: Array<{
    month: string;
    suspiciousRate: number;
    suspiciousCount: number;
    authenticCount: number;
  }>;
  statusDistribution: Array<{ status: string; count: number }>;
  recentClaims: InsuranceClaim[];
}
