import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  BarChart2,
  Camera,
  CheckCircle2,
  Cpu,
  Eye,
  FileSearch,
  Info,
  Layers,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  XCircle,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import AppLayout from '../components/AppLayout';
import { InvestigationStatusBadge, PredictionBadge } from '../components/StatusBadges';
import { apiClient, extractErrorMessage, resolveMediaUrl } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { AnalysisResult, InsuranceClaim, InvestigationRecord } from '../types';

export default function ClaimDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const [claim, setClaim] = useState<InsuranceClaim | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [history, setHistory] = useState<InvestigationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [viewMode, setViewMode] = useState<'original' | 'ela'>('original');
  const [analyzing, setAnalyzing] = useState(false);

  // Investigator decision state
  const [decisionAction, setDecisionAction] = useState<
    'Approve Claim' | 'Reject Claim' | 'Request Manual Verification'
  >('Approve Claim');
  const [remarks, setRemarks] = useState('');
  const [submittingDecision, setSubmittingDecision] = useState(false);
  const [decisionFeedback, setDecisionFeedback] = useState('');

  const loadClaim = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const res = await apiClient.get(`/claims/${id}`);
      setClaim(res.data.claim);
      setAnalysis(res.data.analysisResult || res.data.claim?.latestAnalysisId || null);
      setHistory(res.data.investigationHistory || []);
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load claim details.'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadClaim();
  }, [loadClaim]);

  const handleReAnalyze = async () => {
    if (!claim) return;
    setAnalyzing(true);
    setError('');
    try {
      const res = await apiClient.post(`/claims/${claim._id}/analyze?detectDamage=true`);
      setClaim(res.data.claim);
      setAnalysis(res.data.analysisResult);
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to run AI image analysis.'));
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSubmitDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claim) return;
    setDecisionFeedback('');
    setError('');

    if (remarks.trim().length < 3) {
      setError('Please enter investigation remarks (at least 3 characters).');
      return;
    }

    setSubmittingDecision(true);
    try {
      const res = await apiClient.patch(`/claims/${claim._id}/investigate`, {
        action: decisionAction,
        remarks: remarks.trim(),
      });
      setClaim(res.data.claim);
      setHistory(res.data.investigationHistory || []);
      setRemarks('');
      setDecisionFeedback(res.data.message || 'Investigation decision recorded.');
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to save investigator decision.'));
    } finally {
      setSubmittingDecision(false);
    }
  };

  const details = analysis?.analysisDetails;
  const heatmapUrl = details?.visual_explanation?.heatmap_data_url;
  const isSuspicious = analysis?.prediction === 'SUSPICIOUS';
  const isInvestigator = user?.role === 'investigator';
  const backLink = isInvestigator ? '/investigator' : '/claims';

  return (
    <AppLayout
      title={claim ? `Claim ${claim.claimNumber}` : 'Claim Details'}
      subtitle={
        isInvestigator
          ? 'AI image authenticity assessment, forensic metrics, and investigator decision record'
          : 'Your submitted vehicle claim photo, current status, and investigator response'
      }
      actions={
        <Link
          to={backLink}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
      }
    >
      {error && (
        <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">
          Loading claim record...
        </div>
      ) : !claim ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">
          Claim record not found.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Explicit Demo Mode Notice (Investigator only) */}
          {isInvestigator &&
            (analysis?.isDemoPrediction || claim.isDemoData || analysis?.modelStatus === 'demo_mode') && (
              <div className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                <div>
                  <div className="font-bold">
                    {claim.isDemoData
                      ? 'Sample Demo Record — Not a Real Claim'
                      : 'Demo Mode Analysis — No Trained CNN Model Connected'}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-amber-800">
                    {analysis?.disclaimer ||
                      'This analysis was generated in Demo Mode and must not be treated as a verified real-world CNN fraud verdict. Connect a trained PyTorch CNN checkpoint via CNN_MODEL_PATH on the FastAPI AI service for learned classification.'}
                  </p>
                </div>
              </div>
            )}

          {/* Top Grid: Image Preview + (AI Classification for Investigator / Investigator Reply for Customer) */}
          <div className="grid gap-6 lg:grid-cols-12">
            {/* Uploaded Image */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-6">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-4">
                <h2 className="text-sm font-bold text-[#0B1E3D]">
                  {isInvestigator ? 'Uploaded Vehicle Evidence' : 'Submitted Vehicle Photo'}
                </h2>
                {isInvestigator && heatmapUrl && (
                  <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setViewMode('original')}
                      className={`rounded-lg px-3 py-1 transition ${
                        viewMode === 'original' ? 'bg-white text-[#0B1E3D] shadow-sm' : 'text-slate-600'
                      }`}
                    >
                      Original Photo
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('ela')}
                      className={`rounded-lg px-3 py-1 transition ${
                        viewMode === 'ela' ? 'bg-white text-[#0B1E3D] shadow-sm' : 'text-slate-600'
                      }`}
                    >
                      ELA Heatmap
                    </button>
                  </div>
                )}
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-950">
                <img
                  src={
                    isInvestigator && viewMode === 'ela' && heatmapUrl
                      ? heatmapUrl
                      : resolveMediaUrl(claim.imageUrl)
                  }
                  alt={claim.imageOriginalName}
                  className="max-h-80 w-full object-contain"
                />
              </div>

              {isInvestigator && viewMode === 'ela' && details?.visual_explanation?.description && (
                <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
                  <strong>{details.visual_explanation.type}:</strong> {details.visual_explanation.description}
                </p>
              )}

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
                <span>
                  File: <strong className="text-slate-700">{claim.imageOriginalName}</strong>
                </span>
                {isInvestigator && (
                  <button
                    type="button"
                    onClick={handleReAnalyze}
                    disabled={analyzing}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 px-3 py-1.5 font-semibold text-[#0E2954] transition hover:bg-sky-100 disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${analyzing ? 'animate-spin' : ''}`} />
                    {analyzing ? 'Analyzing...' : analysis ? 'Re-Analyze Image' : 'Analyze Image'}
                  </button>
                )}
              </div>
            </div>

            {isInvestigator ? (
              /* AI Classification Card (Investigator only) */
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-6">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    AI Image Authenticity Result
                  </span>
                  <div className="mt-2 flex items-center gap-3">
                    <PredictionBadge
                      prediction={claim.aiPrediction}
                      isDemo={analysis?.isDemoPrediction}
                    />
                    <InvestigationStatusBadge status={claim.investigationStatus} />
                  </div>
                </div>
                {analysis && (
                  <div className="text-right">
                    <div className="text-xs text-slate-500">Confidence Score</div>
                    <div
                      className={`text-3xl font-extrabold tabular-nums ${
                        isSuspicious ? 'text-rose-600' : 'text-emerald-600'
                      }`}
                    >
                      {analysis.confidence.toFixed(1)}%
                    </div>
                  </div>
                )}
              </div>

              {analysis ? (
                <div className="mt-5 space-y-4">
                  {/* Probability Bars */}
                  <div>
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-emerald-700">Authenticity Probability</span>
                      <span className="tabular-nums text-emerald-700">
                        {analysis.authenticProbability.toFixed(1)}%
                      </span>
                    </div>
                    <div className="mt-1.5 h-3 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{ width: `${analysis.authenticProbability}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-rose-700">Suspicious Probability</span>
                      <span className="tabular-nums text-rose-700">
                        {analysis.suspiciousProbability.toFixed(1)}%
                      </span>
                    </div>
                    <div className="mt-1.5 h-3 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-rose-500"
                        style={{ width: `${analysis.suspiciousProbability}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 pt-2 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs">
                      <div className="text-slate-500">Model Engine Status</div>
                      <div className="mt-1 font-semibold text-[#0B1E3D]">
                        {analysis.modelStatus === 'model_loaded'
                          ? 'Trained CNN Active'
                          : 'Demo Mode (Heuristic)'}
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs">
                      <div className="text-slate-500">Architecture</div>
                      <div className="mt-1 font-semibold text-[#0B1E3D]">
                        {analysis.modelArchitecture || 'VehicleForensicCNN'}
                      </div>
                    </div>
                  </div>

                  {/* Optional YOLO Damage Detection */}
                  {analysis.damageDetection && (
                    <div className="rounded-xl border border-slate-200 bg-[#F9FBFE] p-3.5 text-xs">
                      <div className="flex items-center justify-between font-semibold text-[#0B1E3D]">
                        <span className="flex items-center gap-1.5">
                          <Sparkles className="h-3.5 w-3.5 text-sky-600" />
                          YOLO Damage Localization
                        </span>
                        <span className="text-slate-500">{analysis.damageDetection.model_status}</span>
                      </div>
                      {analysis.damageDetection.detections?.length ? (
                        <ul className="mt-2 space-y-1">
                          {analysis.damageDetection.detections.map((d, idx) => (
                            <li key={idx} className="flex justify-between text-slate-700">
                              <span>{d.label}</span>
                              <span className="font-semibold tabular-nums">{d.confidence}%</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-1.5 text-slate-600">
                          {analysis.damageDetection.message || 'No damage regions detected.'}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50/70 p-3 text-xs text-[#0E2954]">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
                    <span>
                      AI predictions are decision-support signals only and never automatically establish
                      insurance fraud. Final determinations remain with authorized investigators.
                    </span>
                  </div>
                </div>
              ) : (
                <div className="py-10 text-center text-sm text-slate-500">
                  This claim has not been analyzed yet. Click <strong>Analyze Image</strong> to run AI
                  verification.
                </div>
              )}
              </div>
            ) : (
              /* Customer View: Claim Status & Investigator Reply Only */
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-6 flex flex-col justify-between">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Claim Status & Investigator Response
                  </span>
                  <div className="mt-3">
                    <InvestigationStatusBadge status={claim.investigationStatus} />
                  </div>

                  {history.length > 0 ? (
                    <div className="mt-5 rounded-xl border border-slate-200 bg-[#F9FBFE] p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="font-bold text-[#0B1E3D]">
                          Latest Decision: {history[0].action}
                        </span>
                        <span className="text-slate-500 tabular-nums">
                          {new Date(history[0].reviewedAt).toLocaleString()}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        Investigator: <strong className="text-slate-700">{history[0].investigatorName}</strong>
                      </div>
                      <p className="mt-3 rounded-lg bg-white p-3 text-sm leading-relaxed text-slate-800 border border-slate-100">
                        {history[0].remarks}
                      </p>
                    </div>
                  ) : (
                    <div className="mt-5 rounded-xl border border-sky-200 bg-sky-50/70 p-4 text-sm text-[#0E2954]">
                      <div className="font-semibold">Under Investigator Review</div>
                      <p className="mt-1 text-xs leading-relaxed text-slate-600">
                        Your claim and uploaded vehicle photo have been submitted successfully. An authorized
                        insurance investigator will review your submission and post their response here.
                      </p>
                    </div>
                  )}
                </div>

                <div className="mt-6 border-t border-slate-100 pt-4 text-xs text-slate-500">
                  Submitted on {new Date(claim.createdAt).toLocaleString()}
                </div>
              </div>
            )}
          </div>

          {/* Multi-Model Comparison (Investigator only: CNN, YOLO, ResNet18, VGG16, MobileNetV2) */}
          {isInvestigator && analysis?.modelComparisons && analysis.modelComparisons.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
                <div>
                  <h2 className="flex items-center gap-2 text-base font-bold text-[#0B1E3D]">
                    <BarChart2 className="h-5 w-5 text-sky-600" />
                    Multi-Model Authenticity vs. Suspicious Comparison
                  </h2>
                  <p className="text-xs text-slate-500">
                    Side-by-side probability scores across CNN, YOLOv8n-cls, ResNet18, VGG16, and MobileNetV2
                  </p>
                </div>
                <span className="rounded-lg bg-sky-50 px-2.5 py-1 text-xs font-semibold text-[#0E2954]">
                  {analysis.modelComparisons.filter((m) => m.status === 'model_loaded').length} /{' '}
                  {analysis.modelComparisons.length} Models Active
                </span>
              </div>

              <div className="mt-5 grid gap-6 lg:grid-cols-12">
                {/* Per-model probability bars */}
                <div className="space-y-3 lg:col-span-6">
                  {analysis.modelComparisons.map((m) => {
                    const loaded = m.status === 'model_loaded';
                    const authP = m.authentic_probability ?? 0;
                    const suspP = m.suspicious_probability ?? 0;
                    return (
                      <div
                        key={m.model_key}
                        className="rounded-xl border border-slate-200 bg-[#F9FBFE] p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-[#0B1E3D]">{m.model_name}</span>
                            {m.val_accuracy !== null && m.val_accuracy !== undefined && (
                              <span className="rounded bg-slate-200/80 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
                                Val Acc: {m.val_accuracy}%
                              </span>
                            )}
                          </div>
                          {loaded && m.prediction ? (
                            <PredictionBadge prediction={m.prediction} />
                          ) : (
                            <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                              Unavailable
                            </span>
                          )}
                        </div>

                        {loaded ? (
                          <div className="mt-3 space-y-2.5">
                            <div>
                              <div className="flex justify-between text-xs font-medium">
                                <span className="text-emerald-700">Authenticity Probability</span>
                                <span className="tabular-nums font-bold text-emerald-700">
                                  {authP.toFixed(1)}%
                                </span>
                              </div>
                              <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200">
                                <div
                                  className="h-full rounded-full bg-emerald-500"
                                  style={{ width: `${authP}%` }}
                                />
                              </div>
                            </div>

                            <div>
                              <div className="flex justify-between text-xs font-medium">
                                <span className="text-rose-700">Suspicious Probability</span>
                                <span className="tabular-nums font-bold text-rose-700">
                                  {suspP.toFixed(1)}%
                                </span>
                              </div>
                              <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200">
                                <div
                                  className="h-full rounded-full bg-rose-500"
                                  style={{ width: `${suspP}%` }}
                                />
                              </div>
                            </div>

                            <div className="mt-2 rounded-lg border border-slate-200/80 bg-white p-3 text-xs space-y-1.5">
                              {m.architecture && (
                                <div className="text-slate-600">
                                  <strong className="text-[#0B1E3D]">Architecture:</strong> {m.architecture}
                                </div>
                              )}
                              <div className="flex flex-wrap gap-3 text-[11px] text-slate-600">
                                {m.decision_strength && (
                                  <span>
                                    <strong>Strength:</strong> {m.decision_strength}
                                  </span>
                                )}
                                {m.inference_time_ms !== null && m.inference_time_ms !== undefined && (
                                  <span className="tabular-nums">
                                    <strong>Latency:</strong> {m.inference_time_ms} ms
                                  </span>
                                )}
                                {m.logit_margin !== null && m.logit_margin !== undefined && (
                                  <span className="tabular-nums">
                                    <strong>Logit Gap:</strong> {m.logit_margin > 0 ? `+${m.logit_margin}` : m.logit_margin}
                                  </span>
                                )}
                              </div>
                              {m.reason && (
                                <p className="leading-relaxed text-slate-700">
                                  <strong className="text-[#0B1E3D]">Why {m.prediction}:</strong> {m.reason}
                                </p>
                              )}
                              {m.forensic_flags && m.forensic_flags.length > 0 && (
                                <div className="pt-1 text-[11px] text-amber-800">
                                  <strong>Image Forensic Factors:</strong> {m.forensic_flags.join(' · ')}
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <p className="mt-2 text-xs text-slate-500">
                            {m.reason || `Model weights not loaded for ${m.model_name}.`}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Grouped Bar Chart comparing all 5 models */}
                <div className="rounded-xl border border-slate-200 bg-[#F9FBFE] p-4 lg:col-span-6">
                  <div className="text-xs font-bold uppercase tracking-wide text-slate-600">
                    Probability Comparison Chart (%)
                  </div>
                  <div className="mt-3 h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={analysis.modelComparisons
                          .filter((m) => m.status === 'model_loaded')
                          .map((m) => ({
                            model: m.model_name,
                            Authentic: m.authentic_probability ?? 0,
                            Suspicious: m.suspicious_probability ?? 0,
                          }))}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="model" tick={{ fontSize: 11 }} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="Authentic" name="Authenticity %" fill="#10b981" radius={[6, 6, 0, 0]} />
                        <Bar dataKey="Suspicious" name="Suspicious %" fill="#ef4444" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* F. Detailed Image Analysis Section (Investigator only) */}
          {isInvestigator && details && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="border-b border-slate-100 pb-4">
                <h2 className="text-base font-bold text-[#0B1E3D]">Forensic Image Analysis Details</h2>
                <p className="text-xs text-slate-500">
                  Metrics computed directly by the backend forensic inspection pipeline
                </p>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {/* 1. Image Quality */}
                {details.image_quality && (
                  <div className="rounded-xl border border-slate-200 bg-[#F9FBFE] p-4">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#0B1E3D]">
                      <Camera className="h-4 w-4 text-sky-600" />
                      Image Quality
                    </div>
                    <dl className="mt-3 space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <dt className="text-slate-500">Dimensions</dt>
                        <dd className="font-semibold tabular-nums">
                          {details.image_quality.width} × {details.image_quality.height}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-slate-500">Format / Size</dt>
                        <dd className="font-semibold tabular-nums">
                          {details.image_quality.format} · {details.image_quality.file_size_kb} KB
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-slate-500">Sharpness (Laplacian)</dt>
                        <dd className="font-semibold tabular-nums">{details.image_quality.sharpness_score}</dd>
                      </div>
                      <div className="pt-1 text-slate-700">
                        Assessment: <strong>{details.image_quality.assessment}</strong>
                      </div>
                    </dl>
                  </div>
                )}

                {/* 2. Texture Consistency */}
                {details.texture_consistency && (
                  <div className="rounded-xl border border-slate-200 bg-[#F9FBFE] p-4">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#0B1E3D]">
                        <Layers className="h-4 w-4 text-sky-600" />
                        Texture Consistency
                      </span>
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                          details.texture_consistency.anomaly_flagged
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {details.texture_consistency.anomaly_flagged ? 'FLAGGED' : 'NORMAL'}
                      </span>
                    </div>
                    <dl className="mt-3 space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <dt className="text-slate-500">Patch Variance CV</dt>
                        <dd className="font-semibold tabular-nums">
                          {details.texture_consistency.patch_variance_cv}
                        </dd>
                      </div>
                      <p className="pt-1 text-slate-600">{details.texture_consistency.assessment}</p>
                    </dl>
                  </div>
                )}

                {/* 3. Noise Pattern & ELA */}
                {details.noise_pattern && (
                  <div className="rounded-xl border border-slate-200 bg-[#F9FBFE] p-4">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#0B1E3D]">
                        <Eye className="h-4 w-4 text-sky-600" />
                        Noise & ELA Pattern
                      </span>
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                          details.noise_pattern.anomaly_flagged
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {details.noise_pattern.anomaly_flagged ? 'FLAGGED' : 'NORMAL'}
                      </span>
                    </div>
                    <dl className="mt-3 space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <dt className="text-slate-500">ELA Mean / Std</dt>
                        <dd className="font-semibold tabular-nums">
                          {details.noise_pattern.ela_mean_error} / {details.noise_pattern.ela_std_error}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-slate-500">Residual Noise Std</dt>
                        <dd className="font-semibold tabular-nums">
                          {details.noise_pattern.residual_noise_std}
                        </dd>
                      </div>
                      <p className="pt-1 text-slate-600">{details.noise_pattern.assessment}</p>
                    </dl>
                  </div>
                )}

                {/* 4. Edge Artifacts */}
                {details.edge_artifacts && (
                  <div className="rounded-xl border border-slate-200 bg-[#F9FBFE] p-4">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#0B1E3D]">
                        <FileSearch className="h-4 w-4 text-sky-600" />
                        Edge Artifacts
                      </span>
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                          details.edge_artifacts.anomaly_flagged
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {details.edge_artifacts.anomaly_flagged ? 'FLAGGED' : 'NORMAL'}
                      </span>
                    </div>
                    <dl className="mt-3 space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <dt className="text-slate-500">Canny Edge Density</dt>
                        <dd className="font-semibold tabular-nums">
                          {details.edge_artifacts.canny_edge_density}
                        </dd>
                      </div>
                      <p className="pt-1 text-slate-600">{details.edge_artifacts.assessment}</p>
                    </dl>
                  </div>
                )}

                {/* 5. Structural Irregularities */}
                {details.structural_irregularities && (
                  <div className="rounded-xl border border-slate-200 bg-[#F9FBFE] p-4">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#0B1E3D]">
                        <Cpu className="h-4 w-4 text-sky-600" />
                        Structural Integrity
                      </span>
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                          details.structural_irregularities.anomaly_flagged
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {details.structural_irregularities.anomaly_flagged ? 'FLAGGED' : 'NORMAL'}
                      </span>
                    </div>
                    <dl className="mt-3 space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <dt className="text-slate-500">8×8 Block Ratio</dt>
                        <dd className="font-semibold tabular-nums">
                          {details.structural_irregularities.block_boundary_ratio}
                        </dd>
                      </div>
                      <p className="pt-1 text-slate-600">{details.structural_irregularities.assessment}</p>
                    </dl>
                  </div>
                )}

                {/* 6. EXIF Metadata & AI-Generation Suspicion */}
                {details.metadata && (
                  <div className="rounded-xl border border-slate-200 bg-[#F9FBFE] p-4">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#0B1E3D]">
                        <ShieldAlert className="h-4 w-4 text-sky-600" />
                        EXIF & AI Suspicion
                      </span>
                      {details.ai_generation_suspicion && (
                        <span className="rounded bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-800">
                          {details.ai_generation_suspicion.risk_level} Risk
                        </span>
                      )}
                    </div>
                    <dl className="mt-3 space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <dt className="text-slate-500">EXIF Present</dt>
                        <dd className="font-semibold">{details.metadata.exif_present ? 'Yes' : 'No'}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-slate-500">Camera Signature</dt>
                        <dd className="font-semibold">
                          {details.metadata.camera_make || details.metadata.camera_model
                            ? `${details.metadata.camera_make || ''} ${details.metadata.camera_model || ''}`
                            : 'Not detected'}
                        </dd>
                      </div>
                      {details.metadata.software && (
                        <div className="flex justify-between">
                          <dt className="text-slate-500">Software Tag</dt>
                          <dd className="font-semibold text-amber-700">{details.metadata.software}</dd>
                        </div>
                      )}
                    </dl>
                  </div>
                )}
              </div>

              {details.summary_findings && details.summary_findings.length > 0 && (
                <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-bold uppercase tracking-wide text-slate-600">
                    Observed Forensic Findings
                  </div>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-700">
                    {details.summary_findings.map((finding, idx) => (
                      <li key={idx}>{finding}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Claim Metadata + Investigator Decision Controls */}
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-6">
              <h2 className="text-base font-bold text-[#0B1E3D]">Claim & Vehicle Information</h2>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-slate-500">Customer Name</dt>
                  <dd className="font-semibold text-slate-800">{claim.customerName}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Policy Number</dt>
                  <dd className="font-semibold text-slate-800">{claim.policyNumber}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Vehicle Registration</dt>
                  <dd className="font-semibold text-slate-800">{claim.vehicleRegistrationNumber}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Vehicle Model</dt>
                  <dd className="font-semibold text-slate-800">{claim.vehicleModel}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Accident Date</dt>
                  <dd className="font-semibold text-slate-800">
                    {new Date(claim.accidentDate).toLocaleDateString()}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Damage Type</dt>
                  <dd className="font-semibold text-slate-800">{claim.damageType}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs text-slate-500">Accident Location</dt>
                  <dd className="font-semibold text-slate-800">{claim.accidentLocation}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs text-slate-500">Accident Description</dt>
                  <dd className="mt-1 rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-700">
                    {claim.accidentDescription}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="space-y-6 lg:col-span-6">
              {user?.role === 'investigator' && (
                <form
                  onSubmit={handleSubmitDecision}
                  className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <h2 className="flex items-center gap-2 text-base font-bold text-[#0B1E3D]">
                    <ShieldCheck className="h-5 w-5 text-sky-600" />
                    Investigator Final Decision
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Authorized investigators make the final claim determination. All decisions are recorded
                    in the audit log.
                  </p>

                  {decisionFeedback && (
                    <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">
                      {decisionFeedback}
                    </div>
                  )}

                  <div className="mt-4 grid gap-2 sm:grid-cols-3">
                    {(
                      [
                        {
                          label: 'Approve Claim',
                          icon: CheckCircle2,
                          activeClass: 'border-emerald-500 bg-emerald-50 text-emerald-800',
                        },
                        {
                          label: 'Reject Claim',
                          icon: XCircle,
                          activeClass: 'border-rose-500 bg-rose-50 text-rose-800',
                        },
                        {
                          label: 'Request Manual Verification',
                          icon: AlertTriangle,
                          activeClass: 'border-amber-500 bg-amber-50 text-amber-900',
                        },
                      ] as const
                    ).map((opt) => {
                      const Icon = opt.icon;
                      const selected = decisionAction === opt.label;
                      return (
                        <button
                          key={opt.label}
                          type="button"
                          onClick={() => setDecisionAction(opt.label)}
                          className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center text-xs font-semibold transition ${
                            selected ? opt.activeClass : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                          <span>{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-4">
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Investigator Remarks *
                    </label>
                    <textarea
                      rows={3}
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      placeholder="Document findings from image inspection, policy review, or physical verification..."
                      required
                      className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submittingDecision}
                    className="mt-4 w-full rounded-xl bg-[#0B1E3D] py-3 text-sm font-semibold text-white transition hover:bg-[#143666] disabled:opacity-60"
                  >
                    {submittingDecision ? 'Saving Decision...' : `Record "${decisionAction}"`}
                  </button>
                </form>
              )}

              {/* Investigation Audit History */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-base font-bold text-[#0B1E3D]">
                  {isInvestigator ? 'Investigation Audit Trail' : 'Investigator Responses'}
                </h2>
                {history.length === 0 ? (
                  <p className="mt-3 text-xs text-slate-500">
                    No investigator decisions have been recorded for this claim yet.
                  </p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {history.map((rec) => (
                      <div key={rec._id} className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-bold text-[#0B1E3D]">{rec.action}</span>
                          <span className="text-slate-500 tabular-nums">
                            {new Date(rec.reviewedAt).toLocaleString()}
                          </span>
                        </div>
                        <div className="mt-1 text-slate-600">
                          Reviewed by <strong>{rec.investigatorName}</strong> · Status:{' '}
                          <span className="font-semibold">{rec.newStatus}</span>
                        </div>
                        <p className="mt-1.5 text-slate-700">{rec.remarks}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
