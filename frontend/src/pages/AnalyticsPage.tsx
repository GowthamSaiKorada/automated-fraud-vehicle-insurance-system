import { useCallback, useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Calendar, Info } from 'lucide-react';
import AppLayout from '../components/AppLayout';
import { apiClient, extractErrorMessage } from '../api/client';
import { AnalyticsDashboardResponse } from '../types';

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsDashboardResponse | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiClient.get('/analytics/dashboard', {
        params: {
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
        },
      });
      setData(res.data);
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load analytics data.'));
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const summary = data?.summary;

  return (
    <AppLayout
      title="Analytics Dashboard"
      subtitle="Live database metrics on claim authenticity, fraud trends, and investigation outcomes"
    >
      {error && (
        <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      )}

      {data?.hasDemoData && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 p-4 text-xs text-[#0E2954]">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
          <span>
            <strong>Database Analytics (Includes Sample Demo Records):</strong> Charts reflect real MongoDB
            records, including {summary?.demoDataCount} seeded sample demo claim(s). Submit new claims to
            see live updates immediately.
          </span>
        </div>
      )}

      {/* Date Filters */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <Calendar className="h-4 w-4 text-slate-500" />
          <label className="text-xs font-semibold text-slate-600">From:</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-1.5 text-sm"
          />
          <label className="text-xs font-semibold text-slate-600">To:</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-1.5 text-sm"
          />
          {(dateFrom || dateTo) && (
            <button
              type="button"
              onClick={() => {
                setDateFrom('');
                setDateTo('');
              }}
              className="text-xs font-semibold text-sky-600 hover:underline"
            >
              Reset Dates
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-6 text-xs">
          <div>
            <span className="text-slate-500">Total Claims: </span>
            <strong className="tabular-nums text-[#0B1E3D]">{summary?.totalClaims ?? 0}</strong>
          </div>
          <div>
            <span className="text-slate-500">Approved: </span>
            <strong className="tabular-nums text-emerald-700">{summary?.approvedClaims ?? 0}</strong>
          </div>
          <div>
            <span className="text-slate-500">Rejected: </span>
            <strong className="tabular-nums text-rose-700">{summary?.rejectedClaims ?? 0}</strong>
          </div>
          <div>
            <span className="text-slate-500">Avg Confidence: </span>
            <strong className="tabular-nums text-[#0B1E3D]">{summary?.averageConfidence ?? 0}%</strong>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">
          Loading charts...
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* 1. Authentic vs Suspicious Pie Chart */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-bold text-[#0B1E3D]">Authentic vs Suspicious Claims</h2>
            <p className="text-xs text-slate-500">AI classification breakdown across stored claims</p>
            <div className="mt-4 h-72">
              {data?.authenticityDistribution.every((d) => d.value === 0) ? (
                <div className="flex h-full items-center justify-center text-sm text-slate-400">
                  No claims data in selected range
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data?.authenticityDistribution}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={95}
                      paddingAngle={4}
                      label
                    >
                      {data?.authenticityDistribution.map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* 2. Monthly Claim Submissions Bar Chart */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-bold text-[#0B1E3D]">Monthly Claim Submissions</h2>
            <p className="text-xs text-slate-500">Authentic vs suspicious submissions per month</p>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.monthlySubmissions || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="authentic" name="Authentic" fill="#10b981" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="suspicious" name="Suspicious" fill="#ef4444" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 3. Fraud Detection Trend Line Chart */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-bold text-[#0B1E3D]">Suspicious Claim Rate Trend (%)</h2>
            <p className="text-xs text-slate-500">Percentage of monthly claims flagged suspicious</p>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data?.fraudTrend || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="suspiciousRate"
                    name="Suspicious Rate (%)"
                    stroke="#0B1E3D"
                    strokeWidth={3}
                    dot={{ r: 5, fill: '#0ea5e9' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 4. Investigation Status Breakdown */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-bold text-[#0B1E3D]">Claim Investigation Status</h2>
            <p className="text-xs text-slate-500">Current workflow distribution across review states</p>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.statusDistribution || []} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                  <YAxis dataKey="status" type="category" width={150} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" name="Claims" fill="#0ea5e9" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
