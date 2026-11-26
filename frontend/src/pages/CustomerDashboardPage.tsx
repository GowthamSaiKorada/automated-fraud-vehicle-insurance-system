import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  FilePlus2,
  FileText,
  Info,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import AppLayout from '../components/AppLayout';
import { ConfidenceBar, InvestigationStatusBadge, PredictionBadge } from '../components/StatusBadges';
import { apiClient, extractErrorMessage } from '../api/client';
import { AnalyticsDashboardResponse } from '../types';

export default function CustomerDashboardPage() {
  const [data, setData] = useState<AnalyticsDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadDashboard = () => {
    setLoading(true);
    apiClient
      .get('/analytics/dashboard')
      .then((res) => setData(res.data))
      .catch((err) => setError(extractErrorMessage(err, 'Failed to load dashboard data.')))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const handleDeleteClaim = async (claimId: string, claimNumber: string) => {
    if (!window.confirm(`Delete claim ${claimNumber}? This removes it for both you and investigators.`)) {
      return;
    }
    setDeletingId(claimId);
    setError('');
    try {
      await apiClient.delete(`/claims/${claimId}`);
      loadDashboard();
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to delete claim.'));
    } finally {
      setDeletingId(null);
    }
  };

  const summary = data?.summary;

  return (
    <AppLayout
      title="Customer Dashboard"
      subtitle="Track your submitted vehicle claims and AI authenticity verification results"
      actions={
        <Link
          to="/submit-claim"
          className="inline-flex items-center gap-2 rounded-xl bg-[#0B1E3D] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#143666]"
        >
          <FilePlus2 className="h-4 w-4" />
          Submit New Claim
        </Link>
      }
    >
      {error && (
        <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      )}

      {data?.hasDemoData && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-[#0E2954]">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
          <div>
            <strong>Demo Dataset Included:</strong> This account includes{' '}
            {summary?.demoDataCount} seeded sample claims labeled <em>Demo</em> so you can explore
            verification reports immediately. Submit a new claim to run live image forensic analysis.
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500">
            <span>Total Claims Submitted</span>
            <FileText className="h-4 w-4 text-sky-600" />
          </div>
          <div className="mt-3 text-3xl font-bold tabular-nums text-[#0B1E3D]">
            {loading ? '—' : summary?.totalClaims ?? 0}
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-200/80 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-emerald-700">
            <span>Authentic Claims</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-3 text-3xl font-bold tabular-nums text-emerald-700">
            {loading ? '—' : summary?.authenticClaims ?? 0}
          </div>
        </div>

        <div className="rounded-2xl border border-rose-200/80 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-rose-700">
            <span>Suspicious Claims</span>
            <ShieldAlert className="h-4 w-4 text-rose-600" />
          </div>
          <div className="mt-3 text-3xl font-bold tabular-nums text-rose-700">
            {loading ? '—' : summary?.suspiciousClaims ?? 0}
          </div>
        </div>

        <div className="rounded-2xl border border-amber-200/80 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-amber-800">
            <span>Pending Investigations</span>
            <Clock className="h-4 w-4 text-amber-600" />
          </div>
          <div className="mt-3 text-3xl font-bold tabular-nums text-amber-700">
            {loading ? '—' : summary?.pendingReviews ?? 0}
          </div>
        </div>
      </div>

      {/* Prominent CTA Card */}
      <div className="mt-6 flex flex-col items-start justify-between gap-4 rounded-2xl bg-gradient-to-r from-[#0B1E3D] to-[#163D73] p-6 text-white shadow-sm sm:flex-row sm:items-center">
        <div>
          <h2 className="text-lg font-bold">Need to file a new vehicle accident claim?</h2>
          <p className="mt-1 text-sm text-sky-100/85">
            Upload accident photos for instant AI authenticity verification and submit directly to our claims desk.
          </p>
        </div>
        <Link
          to="/submit-claim"
          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-sky-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-400"
        >
          <FilePlus2 className="h-4 w-4" />
          Submit New Claim
        </Link>
      </div>

      {/* Recent Claims Table */}
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-[#0B1E3D]">Recent Claim Submissions</h2>
            <p className="text-xs text-slate-500">Latest claims and AI image verification outcomes</p>
          </div>
          <Link
            to="/claims"
            className="inline-flex items-center gap-1 text-xs font-semibold text-sky-600 hover:underline"
          >
            View All History
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center text-sm text-slate-500">Loading recent claims...</div>
          ) : !data?.recentClaims.length ? (
            <div className="p-10 text-center">
              <AlertTriangle className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-2 text-sm font-medium text-slate-600">No claims submitted yet.</p>
              <Link
                to="/submit-claim"
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-sky-600 hover:underline"
              >
                Submit your first claim
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-6 py-3">Claim ID</th>
                  <th className="px-6 py-3">Vehicle</th>
                  <th className="px-6 py-3">Submitted</th>
                  <th className="px-6 py-3">AI Prediction</th>
                  <th className="px-6 py-3">Confidence</th>
                  <th className="px-6 py-3">Investigation Status</th>
                  <th className="px-6 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.recentClaims.map((claim) => (
                  <tr key={claim._id} className="hover:bg-slate-50/70">
                    <td className="px-6 py-4 font-semibold text-[#0B1E3D] tabular-nums">
                      {claim.claimNumber}
                      {claim.isDemoData && (
                        <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                          SAMPLE
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-800">{claim.vehicleRegistrationNumber}</div>
                      <div className="text-xs text-slate-500">{claim.vehicleModel}</div>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-600 tabular-nums">
                      {new Date(claim.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <PredictionBadge
                        prediction={claim.aiPrediction}
                        isDemo={claim.latestAnalysisId?.isDemoPrediction}
                      />
                    </td>
                    <td className="px-6 py-4">
                      <ConfidenceBar score={claim.confidenceScore} prediction={claim.aiPrediction} />
                    </td>
                    <td className="px-6 py-4">
                      <InvestigationStatusBadge status={claim.investigationStatus} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <Link
                          to={`/claims/${claim._id}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-[#0E2954] transition hover:bg-slate-100"
                        >
                          View Details
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDeleteClaim(claim._id, claim.claimNumber)}
                          disabled={deletingId === claim._id}
                          className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
                          title="Delete claim"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          {deletingId === claim._id ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
