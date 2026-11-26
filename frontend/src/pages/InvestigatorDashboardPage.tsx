import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpDown,
  CheckCircle2,
  Clock,
  FileText,
  Filter,
  Search,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import AppLayout from '../components/AppLayout';
import { ConfidenceBar, InvestigationStatusBadge, PredictionBadge } from '../components/StatusBadges';
import { apiClient, extractErrorMessage } from '../api/client';
import { AnalyticsDashboardResponse, InsuranceClaim } from '../types';

export default function InvestigatorDashboardPage() {
  const [claims, setClaims] = useState<InsuranceClaim[]>([]);
  const [stats, setStats] = useState<AnalyticsDashboardResponse['summary'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [aiPrediction, setAiPrediction] = useState('ALL');
  const [investigationStatus, setInvestigationStatus] = useState('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState<'createdAt' | 'confidenceScore'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [claimsRes, analyticsRes] = await Promise.all([
        apiClient.get('/claims', {
          params: {
            search: search.trim() || undefined,
            aiPrediction,
            investigationStatus,
            dateFrom: dateFrom || undefined,
            dateTo: dateTo || undefined,
            sortBy,
            sortOrder,
          },
        }),
        apiClient.get('/analytics/dashboard'),
      ]);
      setClaims(claimsRes.data.claims || []);
      setStats(analyticsRes.data.summary || null);
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load investigator queue.'));
    } finally {
      setLoading(false);
    }
  }, [search, aiPrediction, investigationStatus, dateFrom, dateTo, sortBy, sortOrder]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const fraudRate =
    stats && stats.totalClaims > 0
      ? ((stats.suspiciousClaims / stats.totalClaims) * 100).toFixed(1)
      : '0.0';

  return (
    <AppLayout
      title="Investigator Dashboard"
      subtitle="Special Investigations Unit (SIU) claim review queue and fraud triage"
    >
      {error && (
        <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* KPI Summary */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold uppercase text-slate-500">
            <span>Total Claims</span>
            <FileText className="h-4 w-4 text-sky-600" />
          </div>
          <div className="mt-2 text-2xl font-bold tabular-nums text-[#0B1E3D]">
            {stats?.totalClaims ?? '—'}
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold uppercase text-emerald-700">
            <span>Authentic</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-bold tabular-nums text-emerald-700">
            {stats?.authenticClaims ?? '—'}
          </div>
        </div>

        <div className="rounded-2xl border border-rose-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold uppercase text-rose-700">
            <span>Suspicious</span>
            <ShieldAlert className="h-4 w-4 text-rose-600" />
          </div>
          <div className="mt-2 text-2xl font-bold tabular-nums text-rose-700">
            {stats?.suspiciousClaims ?? '—'}
          </div>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold uppercase text-amber-800">
            <span>Pending Reviews</span>
            <Clock className="h-4 w-4 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-bold tabular-nums text-amber-700">
            {stats?.pendingReviews ?? '—'}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-[#0B1E3D] p-5 text-white shadow-sm">
          <div className="text-xs font-semibold uppercase text-sky-200">Suspicious Rate</div>
          <div className="mt-2 text-2xl font-bold tabular-nums">{fraudRate}%</div>
          <div className="mt-1 text-[11px] text-sky-200/80">
            Avg Confidence: {stats?.averageConfidence ?? 0}%
          </div>
        </div>
      </div>

      {/* Filters & Search Bar */}
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
          <Filter className="h-3.5 w-3.5" />
          Search & Filter Claims
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="relative lg:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search claim ID, customer, reg #, policy..."
              className="w-full rounded-xl border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-sky-500 focus:outline-none"
            />
          </div>

          <select
            value={aiPrediction}
            onChange={(e) => setAiPrediction(e.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
          >
            <option value="ALL">All Authenticity</option>
            <option value="AUTHENTIC">Authentic Only</option>
            <option value="SUSPICIOUS">Suspicious Only</option>
            <option value="PENDING">Pending Analysis</option>
          </select>

          <select
            value={investigationStatus}
            onChange={(e) => setInvestigationStatus(e.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
          >
            <option value="ALL">All Investigation Status</option>
            <option value="Flagged for Manual Investigation">Flagged for Investigation</option>
            <option value="Pending Review">Pending Review</option>
            <option value="Manual Verification Requested">Manual Verification Requested</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
          </select>

          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            aria-label="Filter from date"
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
          />

          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            aria-label="Filter to date"
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <ArrowUpDown className="h-3.5 w-3.5" />
            <span>Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'createdAt' | 'confidenceScore')}
              className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium"
            >
              <option value="createdAt">Submission Date</option>
              <option value="confidenceScore">Confidence Score</option>
            </select>
            <button
              type="button"
              onClick={() => setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
              className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-[#0B1E3D] hover:bg-slate-50"
            >
              {sortOrder === 'desc' ? 'Highest / Newest' : 'Lowest / Oldest'}
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              setSearch('');
              setAiPrediction('ALL');
              setInvestigationStatus('ALL');
              setDateFrom('');
              setDateTo('');
              setSortBy('createdAt');
              setSortOrder('desc');
            }}
            className="text-xs font-semibold text-sky-600 hover:underline"
          >
            Reset Filters
          </button>
        </div>
      </div>

      {/* Claims Table */}
      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-10 text-center text-sm text-slate-500">Loading claims queue...</div>
          ) : claims.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              No claims match the current filters.
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Claim ID</th>
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">Vehicle</th>
                  <th className="px-5 py-3">Submitted</th>
                  <th className="px-5 py-3">AI Prediction</th>
                  <th className="px-5 py-3">Confidence</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Review</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {claims.map((claim) => (
                  <tr key={claim._id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-4 font-semibold text-[#0B1E3D] tabular-nums">
                      {claim.claimNumber}
                      {claim.isDemoData && (
                        <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                          SAMPLE
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-medium text-slate-800">{claim.customerName}</div>
                      <div className="text-xs text-slate-500">{claim.policyNumber}</div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-medium text-slate-800">{claim.vehicleRegistrationNumber}</div>
                      <div className="text-xs text-slate-500">{claim.vehicleModel}</div>
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-600 tabular-nums">
                      {new Date(claim.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-4">
                      <PredictionBadge
                        prediction={claim.aiPrediction}
                        isDemo={claim.latestAnalysisId?.isDemoPrediction}
                      />
                    </td>
                    <td className="px-5 py-4">
                      <ConfidenceBar score={claim.confidenceScore} prediction={claim.aiPrediction} />
                    </td>
                    <td className="px-5 py-4">
                      <InvestigationStatusBadge status={claim.investigationStatus} />
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <Link
                          to={`/claims/${claim._id}`}
                          className="inline-flex items-center rounded-lg bg-[#0B1E3D] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#143666]"
                        >
                          Inspect Claim
                        </Link>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!window.confirm(`Permanently delete claim ${claim.claimNumber}?`)) return;
                            setDeletingId(claim._id);
                            setError('');
                            try {
                              await apiClient.delete(`/claims/${claim._id}`);
                              fetchDashboard();
                            } catch (err) {
                              setError(extractErrorMessage(err, 'Failed to delete claim.'));
                            } finally {
                              setDeletingId(null);
                            }
                          }}
                          disabled={deletingId === claim._id}
                          className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                          title="Delete claim"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
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
