import { AlertTriangle, CheckCircle2, Clock, ShieldAlert, XCircle } from 'lucide-react';
import { AiPredictionType, InvestigationStatusType } from '../types';

export function PredictionBadge({
  prediction,
  isDemo,
}: {
  prediction: AiPredictionType;
  isDemo?: boolean;
}) {
  if (prediction === 'AUTHENTIC') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
        <CheckCircle2 className="h-3.5 w-3.5" />
        AUTHENTIC
        {isDemo && <span className="ml-0.5 text-[10px] font-medium text-emerald-600/80">(Demo)</span>}
      </span>
    );
  }
  if (prediction === 'SUSPICIOUS') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">
        <ShieldAlert className="h-3.5 w-3.5" />
        SUSPICIOUS
        {isDemo && <span className="ml-0.5 text-[10px] font-medium text-rose-600/80">(Demo)</span>}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
      <Clock className="h-3.5 w-3.5" />
      PENDING
    </span>
  );
}

export function InvestigationStatusBadge({ status }: { status: InvestigationStatusType | string }) {
  switch (status) {
    case 'Approved':
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {status}
        </span>
      );
    case 'Rejected':
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700 ring-1 ring-inset ring-rose-600/20">
          <XCircle className="h-3.5 w-3.5" />
          {status}
        </span>
      );
    case 'Flagged for Manual Investigation':
    case 'Manual Verification Requested':
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-600/20">
          <AlertTriangle className="h-3.5 w-3.5" />
          {status}
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700 ring-1 ring-inset ring-sky-600/20">
          <Clock className="h-3.5 w-3.5" />
          {status}
        </span>
      );
  }
}

export function ConfidenceBar({ score, prediction }: { score: number | null; prediction: AiPredictionType }) {
  if (score === null || score === undefined) {
    return <span className="text-xs text-slate-400">Not analyzed</span>;
  }
  const barColor =
    prediction === 'AUTHENTIC'
      ? 'bg-emerald-500'
      : prediction === 'SUSPICIOUS'
      ? 'bg-rose-500'
      : 'bg-sky-500';

  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-20 overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(100, Math.max(0, score))}%` }} />
      </div>
      <span className="tabular-nums text-xs font-semibold text-slate-700">{score.toFixed(1)}%</span>
    </div>
  );
}
