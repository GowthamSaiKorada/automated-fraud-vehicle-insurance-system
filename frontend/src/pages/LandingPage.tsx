import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Cpu,
  Eye,
  FileCheck2,
  Layers,
  Lock,
  ScanSearch,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function LandingPage() {
  const { user } = useAuth();
  const dashboardTarget = user
    ? user.role === 'investigator'
      ? '/investigator'
      : '/dashboard'
    : '/register';

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-8">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0B1E3D] text-sky-300 shadow-sm">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <span className="block text-base font-bold tracking-tight text-[#0B1E3D]">VeriClaim AI</span>
              <span className="block text-[11px] font-medium text-slate-500">
                Vehicle Insurance Fraud Shield
              </span>
            </div>
          </Link>

          <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
            <a href="#how-it-works" className="transition hover:text-[#0B1E3D]">
              How It Works
            </a>
            <a href="#features" className="transition hover:text-[#0B1E3D]">
              Key Features
            </a>
            <a href="#benefits" className="transition hover:text-[#0B1E3D]">
              Benefits
            </a>
          </nav>

          <div className="flex items-center gap-3">
            {user ? (
              <Link
                to={dashboardTarget}
                className="inline-flex items-center gap-2 rounded-xl bg-[#0B1E3D] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#143666]"
              >
                Go to Dashboard
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#0B1E3D] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#143666]"
                >
                  Get Started
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#081730] via-[#0E2954] to-[#133D7A] py-20 text-white sm:py-24">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-8 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/30 bg-sky-400/10 px-3.5 py-1.5 text-xs font-semibold tracking-wide text-sky-200">
              <Sparkles className="h-3.5 w-3.5" />
              AI-Based Vehicle Insurance Fraud Detection Using Image Authenticity Verification
            </div>
            <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-[3.25rem] lg:leading-[1.12]">
              AI-Powered Vehicle Insurance Fraud Detection
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-sky-100/85 sm:text-lg">
              Verify vehicle accident claim photos before payout. Our CNN-driven computer vision pipeline
              inspects noise residuals, texture consistency, edge artifacts, and metadata to distinguish{' '}
              <strong className="font-semibold text-emerald-300">AUTHENTIC</strong> camera photos from{' '}
              <strong className="font-semibold text-rose-300">SUSPICIOUS</strong> AI-generated or edited
              submissions—empowering investigators with auditable evidence.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                to={dashboardTarget}
                className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-sky-950/40 transition hover:bg-sky-400"
              >
                Get Started
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-white/15"
              >
                Sign In to Portal
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-6 text-xs text-sky-200/80">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                Human-in-the-loop Investigator Controls
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                ELA & Exif Forensic Inspection
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                FastAPI CNN + YOLO Ready
              </span>
            </div>
          </div>

          {/* Interactive-looking Preview Card */}
          <div className="lg:col-span-5">
            <div className="rounded-2xl border border-white/15 bg-white/10 p-6 shadow-2xl backdrop-blur-md">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <div className="text-xs font-medium text-sky-200/75">Sample Forensic Assessment</div>
                  <div className="text-sm font-bold text-white">Claim #CLM-2026-1005</div>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/20 px-3 py-1 text-xs font-bold text-rose-200 ring-1 ring-rose-400/40">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  SUSPICIOUS
                </span>
              </div>
              <div className="mt-5 space-y-4">
                <div>
                  <div className="flex justify-between text-xs font-medium text-sky-100">
                    <span>Suspicious Probability</span>
                    <span className="tabular-nums font-bold text-rose-300">94.5%</span>
                  </div>
                  <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full w-[94.5%] rounded-full bg-rose-500" />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs font-medium text-sky-100">
                    <span>Authenticity Probability</span>
                    <span className="tabular-nums font-bold text-emerald-300">5.5%</span>
                  </div>
                  <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full w-[5.5%] rounded-full bg-emerald-400" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
                  <div className="rounded-xl bg-[#091834]/70 p-3">
                    <div className="text-sky-200/70">Status</div>
                    <div className="mt-1 font-semibold text-amber-300">Flagged for Manual Investigation</div>
                  </div>
                  <div className="rounded-xl bg-[#091834]/70 p-3">
                    <div className="text-sky-200/70">Forensic Signal</div>
                    <div className="mt-1 font-semibold text-white">ELA & Texture Anomaly</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="bg-[#F4F7FB] py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-bold uppercase tracking-widest text-sky-600">End-to-End Workflow</span>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-[#0B1E3D]">How It Works</h2>
            <p className="mt-3 text-sm text-slate-600 sm:text-base">
              A structured four-stage verification pipeline connects policyholders, deep learning forensics, and
              Special Investigations Unit (SIU) reviewers.
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                step: '01',
                title: 'Submit Claim & Photo',
                desc: 'Customers upload JPG/PNG accident photos along with policy, vehicle, and incident details.',
                icon: FileCheck2,
              },
              {
                step: '02',
                title: 'CNN & Forensic Scan',
                desc: 'FastAPI evaluates image artifacts, noise residuals, ELA compression variance, edges, and EXIF metadata.',
                icon: ScanSearch,
              },
              {
                step: '03',
                title: 'Confidence Scoring',
                desc: 'Images are classified as AUTHENTIC or SUSPICIOUS with probability breakdowns and stored in MongoDB.',
                icon: Cpu,
              },
              {
                step: '04',
                title: 'Investigator Decision',
                desc: 'Authorized investigators inspect visual evidence, record remarks, and approve, reject, or request verification.',
                icon: Lock,
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.step}
                  className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-50 text-[#0E2954]">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="text-xs font-bold text-slate-400">STEP {item.step}</span>
                  </div>
                  <h3 className="mt-5 text-base font-bold text-[#0B1E3D]">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Key Features */}
      <section id="features" className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-bold uppercase tracking-widest text-sky-600">Platform Capabilities</span>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-[#0B1E3D]">
              Built for Modern Claims Verification
            </h2>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: 'CNN Authenticity Classifier',
                desc: 'Configurable PyTorch CNN endpoint with explicit Demo Mode transparency whenever trained weights are not attached.',
                icon: Cpu,
              },
              {
                title: 'ELA & Noise Pattern Forensics',
                desc: 'Generates Error Level Analysis heatmaps and measures channel noise residuals to surface digital tampering.',
                icon: Eye,
              },
              {
                title: 'Texture, Edge & Structural Checks',
                desc: 'Detects unnatural patch smoothness, edge density anomalies, and 8x8 JPEG block boundary mismatches.',
                icon: Layers,
              },
              {
                title: 'Investigator Review Desk',
                desc: 'Filterable claims queue sorted by confidence score with audit-logged Approve, Reject, and Verification actions.',
                icon: ShieldCheck,
              },
              {
                title: 'Live Fraud Analytics',
                desc: 'Interactive Recharts dashboards tracking authentic vs suspicious ratios, monthly submissions, and fraud trends.',
                icon: BarChart3,
              },
              {
                title: 'Optional YOLO Damage Detection',
                desc: 'Dedicated /detect-damage FastAPI integration ready for bounding-box vehicle damage localization.',
                icon: ScanSearch,
              },
            ].map((feat) => {
              const Icon = feat.icon;
              return (
                <div
                  key={feat.title}
                  className="rounded-2xl border border-slate-200 bg-[#F9FBFE] p-6 transition hover:border-sky-300 hover:bg-white hover:shadow-sm"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0B1E3D] text-sky-300">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-base font-bold text-[#0B1E3D]">{feat.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{feat.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section id="benefits" className="bg-[#0B1E3D] py-20 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-sky-300">
                Why Insurers Adopt AI Forensics
              </span>
              <h2 className="mt-2 text-3xl font-bold tracking-tight">
                Benefits of AI-Powered Verification
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-sky-100/80 sm:text-base">
                Generative AI and accessible photo editors have made synthetic vehicle damage claims harder to
                spot by eye alone. VeriClaim AI equips claims teams with objective image forensics while keeping
                final authority with human investigators.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                {
                  title: 'Faster Legitimate Payouts',
                  desc: 'Prioritize low-risk authentic claims for rapid settlement.',
                },
                {
                  title: 'Early Fraud Triage',
                  desc: 'Automatically flag synthetic or manipulated submissions for SIU review.',
                },
                {
                  title: 'Defensible Audit Trail',
                  desc: 'Every AI prediction and investigator remark is timestamped in MongoDB.',
                },
                {
                  title: 'Zero Automated Denials',
                  desc: 'AI serves strictly as decision support—authorized investigators hold final say.',
                },
              ].map((b) => (
                <div key={b.title} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <h3 className="text-sm font-bold text-sky-200">{b.title}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-300">{b.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 text-center sm:flex-row sm:px-8 sm:text-left">
          <div>
            <div className="text-sm font-bold text-[#0B1E3D]">
              AI-Based Vehicle Insurance Fraud Detection Using Image Authenticity Verification
            </div>
            <div className="mt-1 text-xs text-slate-500">
              React + Vite + Tailwind CSS · Node.js + Express + MongoDB · Python FastAPI + PyTorch CNN
            </div>
          </div>
          <div className="flex gap-5 text-xs font-semibold text-slate-600">
            <Link to="/login" className="hover:text-[#0B1E3D]">
              Login
            </Link>
            <Link to="/register" className="hover:text-[#0B1E3D]">
              Register
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
