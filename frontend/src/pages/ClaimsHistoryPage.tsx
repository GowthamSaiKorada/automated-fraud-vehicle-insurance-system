import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FilePlus2, Search, Trash2 } from 'lucide-react';
import AppLayout from '../components/AppLayout';
import { ConfidenceBar, InvestigationStatusBadge, PredictionBadge } from '../components/StatusBadges';
import { apiClient, extractErrorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { InsuranceClaim } from '../types';

export default function ClaimsHistoryPage() {
  const { user } = useAuth();
  const [claims, setClaims] = useState<InsuranceClaim[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const endpoint = user?.role === 'investigator' ? '/claims' : '/claims/my';
    setLoading(true);
    apiClient
      .get(endpoint, { params: { search: search.trim() || undefined } })
      .then((res) => setClaims(res.data.claims || []))
      .catch((err) => setError(extractErrorMessage(err, 'Failed to fetch claims history.')))
      .finally(() => setLoading(false));
  }, [user?.role, search]);

  const handleDeleteClaim = async (claimId: string, claimNumber: string) => {
    if (!window.confirm(`Delete claim ${claimNumber}? This permanently removes it from the system.`)) {
      return;
    }
    setDeletingId(claimId);
    setError('');
    try {
      await apiClient.delete(`/claims/${claimId}`);
      setClaims((prev) => prev.filter((c) => c._id !== claimId));
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to delete claim.'));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <AppLayout
      title="Claims History"
      subtitle="Complete record of submitted vehicle accident claims and verification statuses"
      actions={
        <Link
          to="/submit-claim"
          className="inline-flex items-center gap-2 rounded-xl bg-[#0B1E3D] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#143666]"
        >
          <FilePlus2 className="h-4 w-4" />
          New Claim
        </Link>
      }
    >
      {error && (
        <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="mb-5 flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by claim ID, vehicle registration, or model..."
            className="w-full rounded-xl border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-sky-500 focus:outline-none"
          />
        </div>
        <span className="text-xs font-semibold text-slate-500 tabular-nums">
          {claims.length} record{claims.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-10 text-center text-sm text-slate-500">Loading claims history...</div>
          ) : claims.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">No claim records found.</div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-6 py-3">Claim ID</th>
                  <th className="px-6 py-3">Vehicle Reg. #</th>
                  <th className="px-6 py-3">Submission Date</th>
                  <th className="px-6 py-3">AI Prediction</th>
                  <th className="px-6 py-3">Confidence Score</th>
                  <th className="px-6 py-3">Investigation Status</th>
                  <th className="px-6 py-3 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {claims.map((claim) => (
                  <tr key={claim._id} className="hover:bg-slate-50/70">
                    <td className="px-6 py-4 font-semibold text-[#0B1E3D] tabular-nums">
                      {claim.claimNumber}
                      {claim.isDemoData && (
                        <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                          SAMPLE
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-800">
                      {claim.vehicleRegistrationNumber}
                      <div className="text-xs font-normal text-slate-500">{claim.vehicleModel}</div>
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
                          className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-[#0E2954] hover:bg-slate-100"
                        >
                          View Details
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDeleteClaim(claim._id, claim.claimNumber)}
                          disabled={deletingId === claim._id}
                          className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
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
