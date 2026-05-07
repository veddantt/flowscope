import { useState } from 'react';
import { AlertTriangle, BrainCircuit, ChevronDown, Gauge, LineChart, Sparkles } from 'lucide-react';
import { buildAISummary, buildNarrativeEvents } from '../lib/analysis';
import { formatCompact, formatMs, formatPct } from '../lib/format';
import { useSimulationStore } from '../store/simulationStore';
import { useViewport } from '../lib/useViewport';
import { layout } from '../lib/layout';

function MiniTrend({ values, tone, id }: { values: number[]; tone: string; id: string }) {
  const max = Math.max(...values, 1);
  const points = values
    .map((value, index) => `${(index / Math.max(values.length - 1, 1)) * 100},${56 - (value / max) * 48}`)
    .join(' ');
  const areaPoints = `0,60 ${points} 100,60`;

  return (
    <svg viewBox="0 0 100 60" className="h-28 w-full rounded-[22px] border border-white/10 bg-black/40 p-2 transition-all hover:bg-black/60">
      <defs>
        <linearGradient id={`grad-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={tone} stopOpacity="0.3" />
          <stop offset="100%" stopColor={tone} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path fill={`url(#grad-${id})`} d={`M ${areaPoints}`} />
      <polyline fill="none" stroke={tone} strokeWidth="2.8" points={points} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MiniSparkline({ values, tone }: { values: number[]; tone: string }) {
  const max = Math.max(...values, 1);
  const points = values
    .map((value, index) => `${(index / Math.max(values.length - 1, 1)) * 100},${24 - (value / max) * 20}`)
    .join(' ');

  return (
    <svg viewBox="0 0 100 28" className="h-8 w-full">
      <polyline fill="none" stroke={tone} strokeWidth="2" points={points} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AccordionSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="panel overflow-hidden">
      <div className="noise-overlay" />
      <button
        onClick={() => setOpen(!open)}
        className="relative z-10 flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="eyebrow">{title}</span>
        <ChevronDown
          size={14}
          className={`text-white/30 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && <div className="relative z-10 px-4 pb-4">{children}</div>}
    </div>
  );
}

export function InsightsPanel() {
  const { metrics, nodes, metricHistory, getLeadTrace, scenarioId } = useSimulationStore();
  const { tier, isMobile } = useViewport();
  const px = layout.sectionPadding[tier];

  const lead = getLeadTrace();
  const summary = buildAISummary(metrics, nodes, lead, scenarioId);
  const narrative = buildNarrativeEvents(metrics, nodes, metricHistory, scenarioId, lead);
  const topNodes = [...nodes].sort((a, b) => b.load + b.p95Latency / 4 - (a.load + a.p95Latency / 4)).slice(0, 3);

  const latencyTrend = metricHistory.map((item) => item.p95Latency);
  const errorTrend = metricHistory.map((item) => item.errorRate);

  // ─── COMPACT (mobile): accordion layout ─────────────────────────────────────
  if (isMobile) {
    return (
      <section className="grid gap-3">
        <AccordionSection title="ai system analysis" defaultOpen>
          <div className="rounded-[20px] border border-cyan-300/20 bg-cyan-400/10 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-cyan-100">
              <Sparkles size={14} /> {summary.title}
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-100/90">{summary.body}</p>
            <div className="mt-3 rounded-[16px] border border-white/10 bg-slate-950/50 p-3 text-xs text-slate-200">
              <span className="font-semibold text-white">Action:</span> {summary.recommendation}
            </div>
          </div>
        </AccordionSection>

        <AccordionSection title="metrics snapshot">
          <div className="grid grid-cols-2 gap-2">
            <div className="subpanel rounded-[18px] p-3">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-white/40">
                <Gauge size={12} /> inflight
              </div>
              <div className="mt-2 text-xl font-semibold text-white">{formatCompact(metrics.inflight)}</div>
            </div>
            <div className="subpanel rounded-[18px] p-3">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-white/40">
                <AlertTriangle size={12} /> success
              </div>
              <div className="mt-2 text-xl font-semibold text-white">{formatPct(metrics.successRate)}</div>
            </div>
            <div className="subpanel rounded-[18px] p-3">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-white/40">
                <LineChart size={12} /> avg lat
              </div>
              <div className="mt-2 text-xl font-semibold text-white">{formatMs(metrics.avgLatency)}</div>
            </div>
            <div className="subpanel rounded-[18px] p-3">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-white/40">
                <LineChart size={12} /> p95
              </div>
              <div className="mt-2 text-xl font-semibold text-white">{formatMs(metrics.p95Latency)}</div>
            </div>
          </div>
        </AccordionSection>

        <AccordionSection title="trends">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="mb-1 text-[10px] text-white/50">Tail latency</div>
              <MiniSparkline values={latencyTrend} tone="rgba(34,211,238,0.9)" />
            </div>
            <div>
              <div className="mb-1 text-[10px] text-white/50">Error rate</div>
              <MiniSparkline values={errorTrend} tone="rgba(251,191,36,0.9)" />
            </div>
          </div>
        </AccordionSection>

        <AccordionSection title="top bottlenecks">
          <div className="space-y-2">
            {topNodes.map((node, index) => (
              <div key={node.id} className="subpanel flex items-center justify-between rounded-[16px] px-3 py-2">
                <div className="text-xs font-semibold text-white">#{index + 1} {node.label}</div>
                <div className="text-right text-[10px] text-white/60">
                  {Math.round(node.load)}% · {Math.round(node.p95Latency)} ms
                </div>
              </div>
            ))}
          </div>
        </AccordionSection>
      </section>
    );
  }

  // ─── MEDIUM + EXPANDED: full layout ─────────────────────────────────────────
  return (
    <section className="grid gap-5">
      <div className="panel" style={{ padding: `${px}px` }}>
        <div className="noise-overlay" />
        <div className="relative z-10">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="eyebrow">ai system analysis</div>
              <h2 className="mt-2 text-2xl font-semibold text-white">Narrated insights from live telemetry.</h2>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1.5 text-xs text-cyan-100">
              <BrainCircuit size={14} /> explainable
            </div>
          </div>

          <div className="mt-5 rounded-[28px] border border-cyan-300/20 bg-cyan-400/10 p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-cyan-100"><Sparkles size={16} /> {summary.title}</div>
            <p className="mt-3 text-sm leading-6 text-slate-100/90">{summary.body}</p>
            <div className="mt-4 rounded-[22px] border border-white/10 bg-slate-950/50 p-4 text-sm text-slate-200">
              <span className="font-semibold text-white">Recommended action:</span> {summary.recommendation}
            </div>
          </div>
        </div>
      </div>

      <div className="panel" style={{ padding: `${px}px` }}>
        <div className="noise-overlay" />
        <div className="relative z-10">
          <div className="eyebrow">metrics snapshot</div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="subpanel rounded-[24px] p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-white/40"><Gauge size={14} /> inflight load</div>
              <div className="mt-3 text-3xl font-semibold text-white">{formatCompact(metrics.inflight)}</div>
            </div>
            <div className="subpanel rounded-[24px] p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-white/40"><AlertTriangle size={14} /> success rate</div>
              <div className="mt-3 text-3xl font-semibold text-white">{formatPct(metrics.successRate)}</div>
            </div>
            <div className="subpanel rounded-[24px] p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-white/40"><LineChart size={14} /> avg latency</div>
              <div className="mt-3 text-3xl font-semibold text-white">{formatMs(metrics.avgLatency)}</div>
            </div>
            <div className="subpanel rounded-[24px] p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-white/40"><LineChart size={14} /> tail latency</div>
              <div className="mt-3 text-3xl font-semibold text-white">{formatMs(metrics.p95Latency)}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="panel" style={{ padding: `${px}px` }}>
        <div className="noise-overlay" />
        <div className="relative z-10">
          <div className="eyebrow">top bottlenecks</div>
          <div className="mt-4 space-y-3">
            {topNodes.map((node, index) => (
              <div key={node.id} className="subpanel flex items-center justify-between rounded-[22px] px-4 py-3">
                <div>
                  <div className="text-sm font-semibold text-white">#{index + 1} {node.label}</div>
                  <div className="mt-1 text-xs text-white/45">Potential hotspot from combined load + latency score</div>
                </div>
                <div className="text-right text-sm text-white/70">
                  <div>{Math.round(node.load)}% load</div>
                  <div>{Math.round(node.p95Latency)} ms p95</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="panel" style={{ padding: `${px}px` }}>
        <div className="noise-overlay" />
        <div className="relative z-10">
          <div className="eyebrow">trend view</div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <div className="mb-2 text-sm text-white/60">Tail latency trend</div>
              <MiniTrend id="latency" values={latencyTrend} tone="rgba(34,211,238,0.95)" />
            </div>
            <div>
              <div className="mb-2 text-sm text-white/60">Error rate trend</div>
              <MiniTrend id="errors" values={errorTrend} tone="rgba(251,191,36,0.95)" />
            </div>
          </div>
        </div>
      </div>

      <div className="panel" style={{ padding: `${px}px` }}>
        <div className="noise-overlay" />
        <div className="relative z-10">
          <div className="eyebrow">scenario storytelling</div>
          <div className="mt-4 space-y-3">
            {narrative.map((item, index) => (
              <div key={`${item.title}-${index}`} className="subpanel rounded-[22px] p-4">
                <div className="text-sm font-semibold text-white">{item.title}</div>
                <div className="mt-2 text-sm leading-6 text-white/65">{item.body}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default InsightsPanel;
