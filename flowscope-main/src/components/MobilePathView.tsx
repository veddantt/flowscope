import { motion, AnimatePresence } from 'framer-motion';
import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import type { NodeState, SimRequest } from '../types/simulation';

// ─── Accent palette (mirrored from FlowCanvas for consistency) ────────────────
const NODE_ACCENT: Record<string, { hex: string; rgb: string; label: string; role: string }> = {
  edge: { hex: '#38bdf8', rgb: '56,189,248', label: 'Edge', role: 'Ingress + CDN' },
  gateway: { hex: '#818cf8', rgb: '129,140,248', label: 'Gateway', role: 'Rate limit + routing' },
  auth: { hex: '#f472b6', rgb: '244,114,182', label: 'Auth', role: 'JWT + ACL' },
  router: { hex: '#a78bfa', rgb: '167,139,250', label: 'Router', role: 'Request fan-out' },
  cache: { hex: '#34d399', rgb: '52,211,153', label: 'Cache', role: 'Fast reads' },
  service: { hex: '#38bdf8', rgb: '56,189,248', label: 'Core Service', role: 'Business logic' },
  queue: { hex: '#a78bfa', rgb: '167,139,250', label: 'Queue', role: 'Async backpressure' },
  db: { hex: '#fb7185', rgb: '251,113,133', label: 'Database', role: 'Persistent state' },
};

function normalizeId(id?: string) {
  const k = String(id ?? '').toLowerCase().trim();
  if (k === 'core') return 'service';
  if (k === 'database') return 'db';
  return k;
}

function getSeverity(load = 0, latency = 0) {
  const s = load * 0.35 + latency * 0.65;
  return s >= 320 ? 'critical' : s >= 180 ? 'elevated' : 'healthy';
}

type Props = {
  nodes: NodeState[];
  traces: SimRequest[];
};

/**
 * Netflix-style mobile path view.
 * Replaces the full 2000×1100 SVG canvas on compact (mobile) viewports
 * with a vertical, scrollable stack of node cards showing the active request path.
 */
export function MobilePathView({ nodes, traces }: Props) {
  const [traceIndex, setTraceIndex] = useState(0);

  const nodeMap = useMemo(
    () => Object.fromEntries(nodes.map((n) => [normalizeId(n.id), n])) as Record<string, NodeState>,
    [nodes]
  );

  const currentTrace = traces[traceIndex] ?? traces[0];
  const path = useMemo(
    () => (currentTrace?.path ?? ['edge', 'gateway', 'auth', 'service', 'db']).map(normalizeId),
    [currentTrace]
  );
  const activeNodeId = normalizeId(currentTrace?.currentNodeId);

  const prevTrace = () => setTraceIndex((i) => Math.max(0, i - 1));
  const nextTrace = () => setTraceIndex((i) => Math.min(traces.length - 1, i + 1));

  return (
    <div className="canvas-touch flex flex-col gap-3 px-2 py-4">
      {/* Trace navigator */}
      {traces.length > 1 && (
        <div className="flex items-center justify-between px-2">
          <button
            onClick={prevTrace}
            disabled={traceIndex === 0}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 text-white/40 transition hover:bg-white/[0.06] disabled:opacity-20"
          >
            <ChevronLeft size={16} />
          </button>
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-[0.24em] text-white/30">request</div>
            <div className="text-[12px] font-semibold text-white/70">
              {currentTrace?.id ?? '—'}
            </div>
          </div>
          <button
            onClick={nextTrace}
            disabled={traceIndex >= traces.length - 1}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 text-white/40 transition hover:bg-white/[0.06] disabled:opacity-20"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* Path stack */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentTrace?.id ?? 'empty'}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="flex flex-col items-center gap-0"
        >
          {path.map((nodeId, i) => {
            const n = nodeMap[nodeId];
            const acc = NODE_ACCENT[nodeId] ?? { hex: '#38bdf8', rgb: '56,189,248', label: nodeId, role: '' };
            const isActive = nodeId === activeNodeId;
            const sev = getSeverity(n?.load ?? 0, n?.p95Latency ?? 0);
            const isCrit = sev === 'critical';
            const load = Math.round(n?.load ?? 0);
            const latency = Math.round(n?.p95Latency ?? 0);

            return (
              <div key={`${nodeId}-${i}`} className="flex w-full flex-col items-center">
                {/* Connector line between nodes */}
                {i > 0 && (
                  <div
                    className="mobile-path-connector"
                    style={{
                      background: isActive
                        ? `linear-gradient(180deg, ${acc.hex}50, ${acc.hex}15)`
                        : undefined,
                    }}
                  />
                )}

                {/* Node card */}
                <motion.div
                  className="w-full max-w-[340px] rounded-2xl px-4 py-3"
                  animate={{
                    scale: isActive ? 1.02 : 1,
                  }}
                  transition={{ duration: 0.3 }}
                  style={{
                    background: isActive
                      ? `linear-gradient(135deg, rgba(${acc.rgb},0.12) 0%, rgba(${acc.rgb},0.04) 100%)`
                      : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${isActive ? `rgba(${acc.rgb},0.28)` : 'rgba(255,255,255,0.07)'}`,
                    boxShadow: isActive
                      ? `0 0 24px rgba(${acc.rgb},0.12), 0 8px 32px rgba(0,0,0,0.40)`
                      : '0 2px 12px rgba(0,0,0,0.20)',
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      {/* Step number */}
                      <div
                        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                        style={{
                          background: isActive ? `rgba(${acc.rgb},0.18)` : 'rgba(255,255,255,0.06)',
                          color: isActive ? acc.hex : 'rgba(255,255,255,0.35)',
                          border: `1px solid ${isActive ? `rgba(${acc.rgb},0.30)` : 'rgba(255,255,255,0.08)'}`,
                        }}
                      >
                        {i + 1}
                      </div>

                      <div>
                        <div className="text-[13px] font-semibold text-white">{n?.label ?? acc.label}</div>
                        <div className="text-[10px] text-white/35">{acc.role}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-right">
                      <div>
                        <div className="text-[11px] font-bold" style={{ color: isCrit ? '#fb7185' : acc.hex }}>
                          {latency} ms
                        </div>
                        <div className="text-[9px] text-white/30">p95</div>
                      </div>
                      <div>
                        <div className="text-[11px] font-bold text-white/80">{load}%</div>
                        <div className="text-[9px] text-white/30">load</div>
                      </div>
                      <div
                        className="h-2 w-2 rounded-full"
                        style={{
                          backgroundColor: isCrit ? '#fb7185' : sev === 'elevated' ? '#fbbf24' : '#34d399',
                          boxShadow: isActive ? `0 0 8px ${acc.hex}55` : 'none',
                        }}
                      />
                    </div>
                  </div>

                  {/* Load bar */}
                  <div className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
                    <motion.div
                      className="h-full rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${load}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                      style={{ backgroundColor: isCrit ? '#fb7185' : acc.hex, opacity: 0.7 }}
                    />
                  </div>
                </motion.div>
              </div>
            );
          })}
        </motion.div>
      </AnimatePresence>

      {/* Bottom scrubber dots */}
      <div className="mt-2 flex items-center justify-center gap-1.5">
        {path.map((nodeId, i) => {
          const isActive = nodeId === activeNodeId;
          const acc = NODE_ACCENT[nodeId];
          return (
            <div
              key={`dot-${nodeId}-${i}`}
              className="rounded-full transition-all duration-200"
              style={{
                width: isActive ? 16 : 6,
                height: 6,
                backgroundColor: isActive ? (acc?.hex ?? '#38bdf8') : 'rgba(255,255,255,0.15)',
                boxShadow: isActive ? `0 0 8px ${acc?.hex ?? '#38bdf8'}44` : 'none',
              }}
            />
          );
        })}
      </div>

      {/* Status */}
      {currentTrace && (
        <div className="mx-auto mt-1 flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.03] px-3 py-1.5">
          <div
            className="h-1.5 w-1.5 rounded-full"
            style={{
              backgroundColor:
                currentTrace.status === 'failed' ? '#fb7185'
                  : currentTrace.status === 'retrying' ? '#fbbf24'
                    : '#34d399',
            }}
          />
          <span className="text-[10px] capitalize text-white/50">{currentTrace.status}</span>
          <span className="text-[10px] text-white/30">·</span>
          <span className="text-[10px] text-white/40">{Math.round(currentTrace.latencyMs ?? 0)} ms</span>
        </div>
      )}

      {/* Empty state */}
      {traces.length === 0 && (
        <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-6 text-center text-[12px] text-white/35">
          Start the simulation to see requests flow through the system.
        </div>
      )}
    </div>
  );
}

export default MobilePathView;
