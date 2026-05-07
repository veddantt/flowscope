import { motion } from 'framer-motion';
import { formatMs } from '../lib/format';
import { useSimulationStore } from '../store/simulationStore';
import { useViewport } from '../lib/useViewport';
import { layout } from '../lib/layout';
import type { NodeId } from '../types/simulation';

const STEP_COLORS: Record<NodeId, string> = {
  edge: 'bg-sky-400/70',
  gateway: 'bg-cyan-400/70',
  auth: 'bg-indigo-400/70',
  router: 'bg-fuchsia-400/70',
  cache: 'bg-emerald-400/70',
  service: 'bg-violet-400/70',
  queue: 'bg-amber-400/70',
  db: 'bg-rose-400/70',
};

export function TracesPanel() {
  const { requestsById, completed, selectedTraceId, setSelectedTraceId, getLeadTrace } = useSimulationStore();
  const { tier, isMobile } = useViewport();
  const px = layout.sectionPadding[tier];

  const inflight = Object.values(requestsById);
  const traces = [...inflight, ...completed].slice(0, isMobile ? 8 : 14);
  const lead = getLeadTrace();
  const total = Math.max(lead?.latencyMs ?? 1, 1);

  return (
    <section className={`grid gap-5 ${isMobile ? '' : 'xl:grid-cols-[0.95fr_1.05fr]'}`}>
      <div className="panel" style={{ padding: `${px}px` }}>
        <div className="noise-overlay" />
        <div className="relative z-10">
          <div className="flex items-center justify-between gap-3">
          <div>
            <div className="eyebrow">active + recent traces</div>
            <h2 className={`mt-2 font-semibold text-white ${isMobile ? 'text-lg' : 'text-2xl'}`}>
              {isMobile ? 'Request traces' : 'Select a request to inspect its path.'}
            </h2>
          </div>
          <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/60">
            {traces.length} visible
          </div>
        </div>

        <div className={`mt-4 space-y-2 ${isMobile ? 'mt-3 space-y-2' : 'mt-5 space-y-3'}`}>
          {traces.map((trace) => {
            const active = trace.id === selectedTraceId || (!selectedTraceId && trace.id === lead?.id);
            const badge =
              trace.status === 'failed'
                ? 'bg-rose-400/15 text-rose-200'
                : trace.status === 'retrying'
                  ? 'bg-amber-400/15 text-amber-100'
                  : trace.status === 'success'
                    ? 'bg-emerald-400/15 text-emerald-100'
                    : 'bg-cyan-400/15 text-cyan-100';
            return (
              <button
                key={trace.id}
                onClick={() => setSelectedTraceId(trace.id)}
                className={`w-full border text-left transition ${
                  isMobile ? 'rounded-[20px] p-3' : 'rounded-[26px] p-4'
                } ${
                  active ? 'border-cyan-300/35 bg-cyan-400/10' : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className={`font-semibold text-white ${isMobile ? 'text-xs' : 'text-sm'}`}>{trace.id}</div>
                    {!isMobile && (
                      <div className="mt-1 text-xs text-white/45">{trace.path.join(' → ')}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className={`rounded-full px-2 py-1 ${badge}`}>{trace.status}</span>
                    <span className="text-white/55">{formatMs(trace.latencyMs)}</span>
                  </div>
                </div>
              </button>
            );
          })}
          </div>
      </div>
      </div>

      <div className="panel" style={{ padding: `${px}px` }}>
        <div className="noise-overlay" />
        <div className="relative z-10">
          <div className="eyebrow">trace breakdown</div>
        {!lead ? (
          <div className={`mt-5 border border-dashed border-white/10 text-sm text-white/50 ${
            isMobile ? 'rounded-[20px] p-6' : 'rounded-[26px] p-8'
          }`}>
            Start the simulation to inspect a request timeline.
          </div>
        ) : (
          <div className={`space-y-4 ${isMobile ? 'mt-3' : 'mt-5'}`}>
            <div className={`border border-white/10 bg-white/[0.04] ${isMobile ? 'rounded-[20px] p-3' : 'rounded-[26px] p-4'}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className={`font-semibold text-white ${isMobile ? 'text-sm' : 'text-base'}`}>{lead.id}</div>
                  <div className="mt-1 text-xs text-white/45">Current node: {lead.currentNodeId} · Retries: {lead.retries}</div>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-white/60">
                  <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1">Latency {formatMs(lead.latencyMs)}</span>
                  {!isMobile && (
                    <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1">ETA {formatMs(lead.etaMs)}</span>
                  )}
                </div>
              </div>
            </div>

            <div className={`border border-white/10 bg-white/[0.03] ${isMobile ? 'rounded-[20px] p-3' : 'rounded-[26px] p-4'}`}>
              <div className={`font-medium text-white ${isMobile ? 'mb-3 text-xs' : 'mb-4 text-sm'}`}>
                {isMobile ? 'Timeline' : 'Jaeger-style timeline'}
              </div>
              <div className={`space-y-2 ${isMobile ? 'space-y-2' : 'space-y-3'}`}>
                {lead.steps.map((step, index) => {
                  const width = `${Math.max(8, ((step.durationMs ?? 18) / total) * 100)}%`;
                  return (
                    <motion.div
                      key={`${lead.id}-${step.nodeId}-${index}`}
                      className={`grid gap-2 items-center ${
                        isMobile
                          ? 'grid-cols-[80px_1fr_50px]'
                          : 'gap-3 md:grid-cols-[140px_1fr_70px] md:items-center'
                      }`}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                    >
                      <div className={`font-medium text-white ${isMobile ? 'text-xs' : 'text-sm'}`}>
                        {index + 1}. {step.nodeId}
                      </div>
                      <div className={`overflow-hidden rounded-full border border-white/10 bg-black/20 ${isMobile ? 'h-5' : 'h-8'}`}>
                        <div className={`h-full rounded-full ${STEP_COLORS[step.nodeId]}`} style={{ width }} />
                      </div>
                      <div className="text-right text-xs text-white/55">{formatMs(step.durationMs ?? 0)}</div>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {!isMobile && (
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-white/40">path</div>
                  <div className="mt-3 text-sm leading-6 text-white/70">{lead.path.join(' → ')}</div>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-white/40">status</div>
                  <div className="mt-3 text-sm leading-6 text-white/70">
                    {lead.status} {lead.rootCause ? `· ${lead.rootCause}` : ''}
                  </div>
                </div>
              </div>
            )}

            {lead.rootCause ? (
              <div className={`border border-amber-300/20 bg-amber-400/10 text-amber-100 ${
                isMobile ? 'rounded-[20px] p-3 text-xs' : 'rounded-[24px] p-4 text-sm'
              }`}>
                <div className="font-semibold">Root cause hint</div>
                <div className="mt-2 text-amber-50/90">{lead.rootCause}</div>
              </div>
            ) : null}
          </div>
        )}
        </div>
      </div>
    </section>
  );
}

export default TracesPanel;
