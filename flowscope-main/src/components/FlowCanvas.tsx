import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Play, Pause, SkipForward, RotateCcw } from 'lucide-react';

import type { NodeState, SimRequest } from '../types/simulation';
import { useSimulationStore } from '../store/simulationStore';
import { useViewport } from '../lib/useViewport';
import { layout } from '../lib/layout';
import { MobilePathView } from './MobilePathView';

// ─── Types ────────────────────────────────────────────────────────────────────
type Mode = 'normal' | 'focus' | 'replay' | 'cinematic';

type Props = {
  nodes: NodeState[];
  traces: SimRequest[];
};

type PositionedNode = { x: number; y: number };

// ─── Layout constants ─────────────────────────────────────────────────────────
const CARD_W = 220;
const CARD_H = 158;
const HERO_W = 260;
const HERO_H = 174;
const CANVAS_W = 2000;
const CANVAS_H = 1100;

const positions: Record<string, PositionedNode> = {
  edge: { x: 890, y: 60 },
  gateway: { x: 890, y: 250 },
  auth: { x: 450, y: 460 },
  router: { x: 1330, y: 460 },
  cache: { x: 150, y: 670 },
  service: { x: 870, y: 670 },
  queue: { x: 1590, y: 670 },
  db: { x: 870, y: 900 },
};

const layers = [
  { label: 'Client / Edge', y: 60 },
  { label: 'Gateway', y: 250 },
  { label: 'Auth & Routing', y: 460 },
  { label: 'Services Layer', y: 670 },
  { label: 'Data Layer', y: 900 },
];

const GRAPH_EDGES = [
  ['edge', 'gateway'],
  ['gateway', 'auth'],
  ['gateway', 'router'],
  ['auth', 'cache'],
  ['auth', 'service'],
  ['router', 'service'],
  ['router', 'queue'],
  ['service', 'db'],
  ['queue', 'db'],
] as const;

// ─── Per-node accent palette ──────────────────────────────────────────────────
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

const HOVER_HINTS: Record<string, string> = {
  db: 'Check query plans, index coverage, write amplification.',
  service: 'Profile hot handlers and downstream fan-out.',
  cache: 'Inspect hit ratio, TTLs, and eviction pressure.',
  queue: 'Consumer saturation or growing message backlog.',
  auth: 'External identity calls or expensive policy evaluation.',
  gateway: 'Rate limit buckets, timeouts, or upstream saturation.',
  router: 'Fan-out factor or traffic imbalance across upstreams.',
  edge: 'CDN miss rate, TLS overhead, or origin latency.',
};

// ─── Pure helpers ─────────────────────────────────────────────────────────────
function normalizeNodeId(id?: string) {
  const k = String(id ?? '').toLowerCase().trim();
  if (k === 'core') return 'service';
  if (k === 'database') return 'db';
  return k;
}

function getNodeSize(id: string) {
  return id === 'service' ? { w: HERO_W, h: HERO_H } : { w: CARD_W, h: CARD_H };
}

function isActive(nodeId: string, traces: SimRequest[]) {
  return traces.some((t) => normalizeNodeId(t.currentNodeId) === normalizeNodeId(nodeId));
}

function getCurvePath(fromId: string, toId: string, straight = false) {
  const from = positions[fromId];
  const to = positions[toId];
  const { w: fw, h: fh } = getNodeSize(fromId);
  const { w: tw } = getNodeSize(toId);
  const sx = from.x + fw / 2, sy = from.y + fh;
  const ex = to.x + tw / 2, ey = to.y;
  if (straight) return `M ${sx} ${sy} L ${ex} ${ey}`;
  const my = (sy + ey) / 2;
  return `M ${sx} ${sy} C ${sx} ${my}, ${ex} ${my}, ${ex} ${ey}`;
}

function pct(v?: number) { return `${Math.round(v ?? 0)}%`; }
function ms(v?: number) { return `${Math.round(v ?? 0)} ms`; }

function getSeverity(load = 0, latency = 0) {
  const s = load * 0.35 + latency * 0.65;
  return s >= 320 ? 'critical' : s >= 180 ? 'elevated' : 'healthy';
}

function edgeKey(a: string, b: string) { return `${a}-${b}`; }

function getActiveEdges(lead: string) {
  const order = ['edge', 'gateway', 'auth', 'router', 'service', 'queue', 'db'];
  const set = new Set<string>();
  if (lead === 'cache') {
    set.add(edgeKey('edge', 'gateway'));
    set.add(edgeKey('gateway', 'auth'));
    set.add(edgeKey('auth', 'cache'));
    return set;
  }
  if (lead === 'queue') {
    set.add(edgeKey('edge', 'gateway'));
    set.add(edgeKey('gateway', 'router'));
    set.add(edgeKey('router', 'queue'));
    return set;
  }
  const idx = order.indexOf(lead);
  if (idx < 0) return set;
  for (let i = 0; i < idx; i++) {
    const from = order[i], to = order[i + 1];
    if (from === 'gateway' && to === 'auth') {
      set.add(edgeKey('gateway', 'auth'));
      set.add(edgeKey('gateway', 'router'));
    } else {
      set.add(edgeKey(from, to));
    }
  }
  return set;
}

function buildReplaySeq(traces: SimRequest[]) {
  const ids = [...new Set(traces.map((t) => normalizeNodeId(t.currentNodeId)).filter(Boolean))];
  return ids.length > 0 ? ids : ['edge', 'gateway', 'auth', 'router', 'service', 'queue', 'db'];
}

function buildInsight(nodeMap: Record<string, NodeState>, leadId: string) {
  const entries = Object.entries(nodeMap).map(([id, n]) => ({
    id, label: n.label ?? NODE_ACCENT[id]?.label ?? id.toUpperCase(),
    load: n.load ?? 0, latency: n.p95Latency ?? 0,
    score: (n.load ?? 0) * 0.35 + (n.p95Latency ?? 0) * 0.65,
  }));
  const lead = entries.find((e) => e.id === leadId) ?? entries.sort((a, b) => b.score - a.score)[0];
  if (!lead) return { title: 'System stable', summary: 'No clear bottleneck detected.', bullets: ['Traffic is distributed normally.'] };
  const hl = lead.latency >= 300, hlo = lead.load >= 70;
  if (lead.id === 'db') return { title: 'Database bottleneck detected', summary: 'Persistent storage is the dominant latency source.', bullets: [`DB p95: ${Math.round(lead.latency)} ms`, 'Queue and core likely accumulating backpressure.', 'Prioritize query opt, indexing, or caching hot paths.'] };
  if (lead.id === 'queue') return { title: 'Queue backpressure building', summary: 'The async boundary is slowing throughput.', bullets: [`Queue latency: ${Math.round(lead.latency)} ms`, 'Consumers may be saturated.', 'Consider scaling workers or reducing write pressure.'] };
  if (lead.id === 'service') return { title: 'Core service is the critical path', summary: 'Business logic execution is the main latency contributor.', bullets: [`Core load: ${Math.round(lead.load)}%`, `Core p95: ${Math.round(lead.latency)} ms`, 'Profile hot handlers and trim fan-out.'] };
  if (lead.id === 'cache') return { title: 'Cache shaping response time', summary: 'Cache layer is active in the critical path.', bullets: [`Cache p95: ${Math.round(lead.latency)} ms`, 'Inspect hit ratio and eviction patterns.', 'Validate router sends right traffic to cacheable paths.'] };
  if (lead.id === 'auth') return { title: 'Auth stage slowing request path', summary: 'Auth checks are becoming expensive.', bullets: [`Auth p95: ${Math.round(lead.latency)} ms`, 'JWT validation or external identity calls may contribute.', 'Consider caching claims or reducing sync auth overhead.'] };
  if (hl || hlo) return { title: `${lead.label} is under pressure`, summary: 'This node is contributing disproportionate latency or load.', bullets: [`${lead.label} load: ${Math.round(lead.load)}%`, `${lead.label} p95: ${Math.round(lead.latency)} ms`, 'Trace requests through this stage first.'] };
  return { title: 'System healthy', summary: 'No single node is dominating the performance budget.', bullets: ['No major bottleneck currently obvious.', 'Traffic flowing normally.', 'Continue monitoring p95 and queue growth.'] };
}

function getTimeline(nodeMap: Record<string, NodeState>) {
  return ['edge', 'gateway', 'auth', 'router', 'service', 'queue', 'db']
    .filter((id) => nodeMap[id])
    .map((id, i) => {
      const n = nodeMap[id];
      return {
        id, step: i + 1,
        label: n?.label ?? NODE_ACCENT[id]?.label ?? id.toUpperCase(),
        load: Math.round(n?.p95Latency ? n.load ?? 0 : 0),
        latency: Math.round(n?.p95Latency ?? 0),
        severity: getSeverity(n?.load, n?.p95Latency),
      };
    });
}

function traceLatency(trace: SimRequest, nodeMap: Record<string, NodeState>) {
  if (typeof trace.latencyMs === 'number') return Math.round(trace.latencyMs);
  if (Array.isArray(trace.path)) return trace.path.reduce((s, id) => s + Math.round(nodeMap[normalizeNodeId(id)]?.p95Latency ?? 0), 0);
  return 0;
}

function traceStatus(trace: SimRequest) {
  if ((trace as { failed?: boolean }).failed) return 'Failed';
  if ((trace as { retrying?: boolean }).retrying) return 'Retrying';
  return trace.status ?? 'Active';
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FlowParticle({ path, delay = 0, duration = 2.2, color = '#38bdf8', size = 4, cinematic = false }: {
  path: string; delay?: number; duration?: number; color?: string; size?: number; cinematic?: boolean;
}) {
  const d = cinematic ? duration * 1.6 : duration;
  return (
    <g>
      {cinematic && (
        <circle r={size * 5} fill={`${color}12`} style={{ filter: `blur(${size * 2}px)` }}>
          <animateMotion dur={`${d}s`} begin={`${delay}s`} repeatCount="indefinite" path={path} />
        </circle>
      )}
      <circle r={size * 2.6} fill={`${color}25`} style={{ filter: `blur(${size}px)` }}>
        <animateMotion dur={`${d}s`} begin={`${delay}s`} repeatCount="indefinite" path={path} />
      </circle>
      <circle r={size} fill={color}>
        <animateMotion dur={`${d}s`} begin={`${delay}s`} repeatCount="indefinite" path={path} />
      </circle>
      <circle r={size * 0.35} fill="rgba(255,255,255,0.9)">
        <animateMotion dur={`${d}s`} begin={`${delay}s`} repeatCount="indefinite" path={path} />
      </circle>
    </g>
  );
}

function LatencyRing({ latency, color }: { latency: number; color: string }) {
  const r = 18;
  const circ = 2 * Math.PI * r;
  const fill = Math.min(1, latency / 500) * circ;

  return (
    <div className="relative flex h-11 w-11 flex-shrink-0 items-center justify-center">
      <svg width="44" height="44" className="absolute inset-0" style={{ overflow: 'visible' }}>
        <circle cx="22" cy="22" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2.5" />
        <motion.circle
          cx="22" cy="22" r={r} fill="none" stroke={color} strokeWidth="2.5"
          strokeLinecap="round" strokeDasharray={`${circ}`}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - fill }}
          transition={{ duration: 1.0, ease: 'easeOut' }}
          style={{ transformOrigin: '22px 22px', rotate: '-90deg' }}
        />
      </svg>
      <div className="relative z-10 text-center">
        <div className="text-[9px] font-bold leading-none" style={{ color }}>{Math.round(latency)}</div>
        <div className="mt-[2px] text-[7px] leading-none text-white/35">ms</div>
      </div>
    </div>
  );
}

function LoadBar({ load, color }: { load: number; color: string }) {
  const segs = 8;
  const filled = Math.round((load / 100) * segs);

  return (
    <div className="flex gap-[3px]">
      {Array.from({ length: segs }).map((_, i) => (
        <motion.div
          key={i}
          className="h-[3.5px] flex-1 rounded-full"
          animate={{ opacity: i < filled ? 0.85 : 0.10 }}
          transition={{ duration: 0.4, delay: i * 0.035 }}
          style={{ backgroundColor: i < filled ? color : 'rgba(255,255,255,0.12)' }}
        />
      ))}
    </div>
  );
}

function PulseDot({ color, active, isAnimating }: { color: string; active: boolean; isAnimating: boolean }) {
  return (
    <div className="relative flex h-3 w-3 flex-shrink-0 items-center justify-center">
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{ backgroundColor: color }}
        animate={
          active
            ? { scale: [1, 2.5, 1], opacity: [0.7, 0, 0.7] }
            : !isAnimating
              ? { scale: [1, 1.2, 1], opacity: [0.4, 0.2, 0.4] }
              : { scale: 1, opacity: 0 }
        }
        transition={{
          duration: active ? 1.6 : 3.5,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      <div
        className="h-2.5 w-2.5 rounded-full"
        style={{
          backgroundColor: color,
          boxShadow: active ? `0 0 5px ${color}, 0 0 12px ${color}55` : `0 0 4px ${color}33`,
        }}
      />
    </div>
  );
}

function CinematicOverlay({ active }: { active: boolean }) {
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          className="pointer-events-none absolute inset-0 z-20"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
          style={{
            background: [
              'radial-gradient(ellipse 60% 40% at 50% 50%, transparent 30%, rgba(0,0,0,0.55) 100%)',
              'linear-gradient(180deg, rgba(0,0,0,0.30) 0%, transparent 15%, transparent 85%, rgba(0,0,0,0.30) 100%)',
            ].join(', '),
          }}
        />
      )}
    </AnimatePresence>
  );
}

function LetterboxBars({ active }: { active: boolean }) {
  return (
    <AnimatePresence>
      {active && (
        <>
          <motion.div
            className="pointer-events-none absolute inset-x-0 top-0 z-40 bg-black"
            initial={{ height: 0 }}
            animate={{ height: 28 }}
            exit={{ height: 0 }}
            transition={{ duration: 0.6, ease: [0.32, 0, 0.67, 0] }}
          />
          <motion.div
            className="pointer-events-none absolute inset-x-0 bottom-0 z-40 bg-black"
            initial={{ height: 0 }}
            animate={{ height: 28 }}
            exit={{ height: 0 }}
            transition={{ duration: 0.6, ease: [0.32, 0, 0.67, 0] }}
          />
        </>
      )}
    </AnimatePresence>
  );
}

function NodeSpotlight({ nodeId, color, active }: { nodeId: string; color: string; active: boolean }) {
  const pos = positions[nodeId];
  const { w, h } = getNodeSize(nodeId);
  if (!pos) return null;
  const cx = pos.x + w / 2;
  const cy = pos.y + h / 2;

  return (
    <AnimatePresence>
      {active && (
        <motion.ellipse
          cx={cx} cy={cy} rx={w * 0.85} ry={h * 0.75}
          fill="none"
          stroke={color}
          strokeWidth="1"
          initial={{ opacity: 0, rx: w * 0.3, ry: h * 0.3 }}
          animate={{ opacity: [0, 0.55, 0.25], rx: w * 0.85, ry: h * 0.75 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
          style={{ filter: `drop-shadow(0 0 12px ${color})` }}
        />
      )}
    </AnimatePresence>
  );
}

function CinematicHUD({ nodeId, nodeMap, active }: { nodeId: string; nodeMap: Record<string, NodeState>; active: boolean }) {
  const acc = NODE_ACCENT[nodeId];
  const n = nodeMap[nodeId];
  if (!acc || !n) return null;
  const sev = getSeverity(n.load ?? 0, n.p95Latency ?? 0);

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          className="pointer-events-none absolute bottom-8 left-1/2 z-30 -translate-x-1/2"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
        >
          <div
            className="flex items-center gap-3 rounded-2xl px-5 py-3"
            style={{
              background: 'rgba(4,10,22,0.92)',
              border: `1px solid rgba(${acc.rgb},0.28)`,
              boxShadow: `0 0 30px rgba(${acc.rgb},0.18), 0 20px 60px rgba(0,0,0,0.70)`,
              backdropFilter: 'blur(24px)',
            }}
          >
            <motion.div
              className="h-2 w-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: acc.hex, boxShadow: `0 0 8px ${acc.hex}` }}
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            />
            <div>
              <div className="text-[11px] font-semibold leading-none text-white">{acc.label}</div>
              <div className="mt-0.5 text-[9.5px] leading-none text-white/40">{acc.role}</div>
            </div>
            <div className="h-7 w-px bg-white/10" />
            <div className="flex gap-3 text-center">
              <div>
                <div className="text-[10px] font-bold" style={{ color: acc.hex }}>{pct(n.load)}</div>
                <div className="text-[8.5px] text-white/35">load</div>
              </div>
              <div>
                <div className="text-[10px] font-bold" style={{ color: sev === 'critical' ? '#fb7185' : acc.hex }}>{ms(n.p95Latency)}</div>
                <div className="text-[8.5px] text-white/35">p95</div>
              </div>
            </div>
            <div
              className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide"
              style={{
                background: sev === 'critical' ? 'rgba(239,68,68,0.15)' : sev === 'elevated' ? 'rgba(245,158,11,0.13)' : `rgba(${acc.rgb},0.12)`,
                color: sev === 'critical' ? '#fca5a5' : sev === 'elevated' ? '#fcd34d' : acc.hex,
                border: `1px solid ${sev === 'critical' ? 'rgba(239,68,68,0.25)' : sev === 'elevated' ? 'rgba(245,158,11,0.22)' : `rgba(${acc.rgb},0.20)`}`,
              }}
            >
              {sev === 'critical' ? '⚠ critical' : sev === 'elevated' ? '↑ elevated' : '● ok'}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function CinematicNodeBanner({ nodeId, visible }: { nodeId: string; visible: boolean }) {
  const acc = NODE_ACCENT[nodeId];
  if (!acc) return null;

  return (
    <AnimatePresence mode="wait">
      {visible && (
        <motion.div
          key={nodeId}
          className="pointer-events-none absolute left-8 top-8 z-30"
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -12 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        >
          <div className="mb-1 text-[9px] uppercase tracking-[0.32em]" style={{ color: `rgba(${acc.rgb},0.55)` }}>
            analyzing
          </div>
          <div
            className="text-[22px] font-bold tracking-tight"
            style={{ color: acc.hex, textShadow: `0 0 30px rgba(${acc.rgb},0.5)` }}
          >
            {acc.label}
          </div>
          <div className="mt-0.5 text-[11px] text-white/35">{acc.role}</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Floating Sim Controls (lives inside the canvas panel) ────────────────────
function FloatingSimControls() {
  const { isRunning, speed, start, stop, step, reset, setSpeed } = useSimulationStore();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <motion.div
      className="absolute bottom-4 left-1/2 z-40 -translate-x-1/2"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut', delay: 0.15 }}
    >
      <AnimatePresence mode="wait">
        {collapsed ? (
          <motion.button
            key="collapsed"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.18 }}
            onClick={() => setCollapsed(false)}
            className="flex items-center gap-2 rounded-2xl px-4 py-2.5 text-[11px] font-medium transition-all duration-200"
            style={{
              background: 'rgba(4,10,22,0.92)',
              border: `1px solid ${isRunning ? 'rgba(56,189,248,0.25)' : 'rgba(255,255,255,0.10)'}`,
              boxShadow: `0 4px 30px rgba(0,0,0,0.60), 0 0 0 1px rgba(255,255,255,0.04)${isRunning ? ', 0 0 20px rgba(56,189,248,0.12)' : ''}`,
              backdropFilter: 'blur(24px)',
              color: isRunning ? '#7dd3fc' : 'rgba(255,255,255,0.50)',
            }}
          >
            {isRunning ? <Pause size={13} /> : <Play size={13} />}
            {isRunning ? 'Running' : 'Paused'}
            <span className="text-[9px] text-white/25">▲</span>
          </motion.button>
        ) : (
          <motion.div
            key="expanded"
            initial={{ opacity: 0, scale: 0.92, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 8 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-1.5 rounded-2xl px-2.5 py-2"
            style={{
              background: 'rgba(4,10,22,0.92)',
              border: `1px solid ${isRunning ? 'rgba(56,189,248,0.20)' : 'rgba(255,255,255,0.10)'}`,
              boxShadow: `0 4px 30px rgba(0,0,0,0.60), 0 0 0 1px rgba(255,255,255,0.04)${isRunning ? ', 0 0 24px rgba(56,189,248,0.10)' : ''}`,
              backdropFilter: 'blur(24px)',
            }}
          >
            {/* Play / Pause */}
            <button
              onClick={isRunning ? stop : start}
              className="flex items-center gap-1.5 rounded-[12px] px-3.5 py-1.5 text-[11px] font-semibold transition-all duration-200"
              style={{
                background: isRunning ? 'rgba(56,189,248,0.15)' : 'rgba(56,189,248,0.90)',
                color: isRunning ? '#7dd3fc' : '#000',
                border: isRunning ? '1px solid rgba(56,189,248,0.30)' : '1px solid rgba(56,189,248,0.60)',
                boxShadow: isRunning ? 'none' : '0 0 16px rgba(56,189,248,0.30)',
              }}
            >
              {isRunning ? <Pause size={13} /> : <Play size={13} />}
              {isRunning ? 'Pause' : 'Start'}
            </button>

            <div className="mx-0.5 h-5 w-px bg-white/8" />

            {/* Step */}
            <button
              onClick={step}
              title="Advance one step"
              className="flex items-center gap-1 rounded-[12px] px-2.5 py-1.5 text-[11px] text-white/50 transition-all duration-150 hover:bg-white/[0.06] hover:text-white/80"
              style={{ border: '1px solid transparent' }}
            >
              <SkipForward size={13} />
              <span className="hidden sm:inline">Step</span>
            </button>

            {/* Reset */}
            <button
              onClick={reset}
              title="Reset simulation"
              className="flex items-center gap-1 rounded-[12px] px-2.5 py-1.5 text-[11px] text-white/50 transition-all duration-150 hover:bg-white/[0.06] hover:text-white/80"
              style={{ border: '1px solid transparent' }}
            >
              <RotateCcw size={13} />
              <span className="hidden sm:inline">Reset</span>
            </button>

            <div className="mx-0.5 h-5 w-px bg-white/8" />

            {/* Speed */}
            <div className="flex items-center gap-1.5 px-1">
              <span className="text-[9px] font-medium uppercase tracking-wider text-white/30">spd</span>
              <input
                className="range-premium w-[70px]"
                type="range"
                min={1}
                max={5}
                step={1}
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
              />
              <span className="w-5 text-center font-mono text-[10px] text-white/40">{speed}×</span>
            </div>

            <div className="mx-0.5 h-5 w-px bg-white/8" />

            {/* Collapse */}
            <button
              onClick={() => setCollapsed(true)}
              title="Minimize controls"
              className="flex h-6 w-6 items-center justify-center rounded-lg text-[10px] text-white/30 transition hover:bg-white/[0.06] hover:text-white/60"
            >
              ▼
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function FlowCanvas({ nodes, traces }: Props) {
  const { tier, mode: interactionMode, isMobile, isTablet } = useViewport();

  const [mode, setMode] = useState<Mode>('normal');

  const [sceneIndex, setSceneIndex] = useState(0);
  const playbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [zoom, setZoom] = useState(1);
  const [showTraces, setShowTraces] = useState(false);
  const [selectedTrace, setSelectedTrace] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [clickedTrace, setClickedTrace] = useState<string | null>(null);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);

  const isAnimating = mode === 'replay' || mode === 'cinematic';
  const isFocusActive = mode === 'focus' || mode === 'cinematic';
  const isCinematic = mode === 'cinematic';

  const nodeMap = useMemo(() => Object.fromEntries(nodes.map((n) => [normalizeNodeId(n.id), n])) as Record<string, NodeState>, [nodes]);
  const leadReq = useMemo(() => traces?.[0], [traces]);
  const focusPath = useMemo(() => (leadReq?.path ?? []).map(normalizeNodeId), [leadReq]);
  const replaySeq = useMemo(() => buildReplaySeq(traces), [traces]);
  const clickedPath = useMemo(() => (traces.find((t) => String(t.id) === clickedTrace)?.path ?? []).map(normalizeNodeId), [traces, clickedTrace]);
  const timeline = useMemo(() => getTimeline(nodeMap), [nodeMap]);

  const story = useMemo(() => nodes.map((n) => ({
    id: normalizeNodeId(n.id),
    title: n.label,
    latency: n.p95Latency ?? 0,
    load: n.load ?? 0,
    description:
      (n.p95Latency ?? 0) > 300
        ? `${n.label} is causing high latency`
        : (n.load ?? 0) > 70
          ? `${n.label} is under heavy load`
          : `${n.label} operating normally`,
  })), [nodes]);

  const stopPlayback = useCallback(() => {
    if (playbackRef.current) {
      clearTimeout(playbackRef.current);
      playbackRef.current = null;
    }
  }, []);

  const handleModeChange = useCallback((m: Mode) => {
    setMode((prev) => (prev === m ? 'normal' : m));
  }, []);

  useEffect(() => {
    stopPlayback();
    setSceneIndex(0);

    if (!isAnimating) return;

    const seq = isCinematic
      ? story.map((s) => s.id)
      : replaySeq;

    if (seq.length === 0) return;

    let idx = 0;

    const step = () => {
      const nodeId = seq[idx % seq.length];
      const node = nodeMap[nodeId];
      const latency = node?.p95Latency ?? 0;
      const load = node?.load ?? 0;

      const delay = isCinematic
        ? latency > 300 ? 1800
          : latency > 150 ? 1200
            : load > 70 ? 1000
              : 800
        : latency > 300 ? 1200
          : latency > 150 ? 800
            : 600;

      setSceneIndex(idx % seq.length);

      playbackRef.current = setTimeout(() => {
        idx++;
        step();
      }, delay);
    };

    step();

    return () => stopPlayback();
  }, [mode, isAnimating, isCinematic, replaySeq, story, nodeMap, stopPlayback]);

  const effectiveId = useMemo(() => {
    if (isAnimating) {
      const seq = isCinematic ? story.map((s) => s.id) : replaySeq;
      return seq[sceneIndex] ?? 'service';
    }
    return normalizeNodeId(traces[0]?.currentNodeId) || 'service';
  }, [isAnimating, isCinematic, story, replaySeq, sceneIndex, traces]);

  const activeEdges = useMemo(
    () => (mode === 'normal' ? new Set<string>() : getActiveEdges(effectiveId)),
    [mode, effectiveId]
  );
  const insight = useMemo(() => buildInsight(nodeMap, effectiveId), [nodeMap, effectiveId]);

  useEffect(() => {
    if (!isAnimating && !isFocusActive) return;
    const el = viewportRef.current;
    const pos = positions[effectiveId];
    if (!el || !pos) return;
    const { w, h } = getNodeSize(effectiveId);
    el.scrollTo({
      left: Math.max(0, pos.x + w / 2 - el.clientWidth / 2) * zoom,
      top: Math.max(0, pos.y + h / 2 - el.clientHeight / 2) * zoom,
      behavior: 'smooth',
    });
  }, [effectiveId, isAnimating, isFocusActive, zoom]);

  useEffect(() => {
    if (!selectedTrace && traces[0]?.id != null) setSelectedTrace(String(traces[0].id));
  }, [traces, selectedTrace]);

  function isFocused(id: string) {
    if (!isFocusActive) return true;
    if (clickedPath.length > 0) return clickedPath.includes(id);
    if (focusPath.length > 0) return focusPath.includes(id);
    return effectiveId === id || isActive(id, traces);
  }

  const handleZoomIn = () => setZoom((s) => Math.min(1.6, +(s + 0.1).toFixed(2)));
  const handleZoomOut = () => setZoom((s) => Math.max(0.4, +(s - 0.1).toFixed(2)));

  const modeButtons: { id: Mode; label: string; icon: string; hex: string; rgb: string }[] = [
    { id: 'normal', label: 'Normal', icon: '◎', hex: 'rgba(255,255,255,0.45)', rgb: '255,255,255' },
    { id: 'focus', label: 'Focus', icon: '⊙', hex: '#38bdf8', rgb: '56,189,248' },
    { id: 'replay', label: 'Replay', icon: '▶', hex: '#a78bfa', rgb: '167,139,250' },
    { id: 'cinematic', label: 'Cinematic', icon: '🎬', hex: '#fbbf24', rgb: '251,191,36' },
  ];

  // Adaptive padding from layout tokens
  const sectionPx = layout.sectionPadding[tier];
  const canvasPad = layout.canvasPadding[tier];

  return (
    <section
      className="w-full"
      style={{ padding: `${canvasPad}px ${sectionPx}px` }}
    >
      {/* Header — condensed on mobile */}
      <div className={`mb-4 flex flex-col gap-3 ${
        isMobile ? '' : 'xl:flex-row xl:items-end xl:justify-between mb-6 gap-4'
      }`}>
        <div>
          {!isMobile && (
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.30em] text-cyan-400/55">live request flow</div>
          )}
          <h2 className={`font-semibold text-white ${
            isMobile ? 'text-lg' : 'text-2xl md:text-3xl'
          }`}>
            {isMobile ? 'Flow Topology' : 'Service topology · diagnosis · replay'}
          </h2>
          {!isMobile && (
            <p className="mt-1.5 max-w-xl text-sm text-white/45">Track requests layer by layer, isolate bottlenecks, and replay the critical path.</p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <AnimatePresence mode="wait">
            <motion.div
              key={mode}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ duration: 0.18 }}
              className="rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-widest"
              style={{
                background: isCinematic ? 'rgba(251,191,36,0.14)'
                  : mode === 'replay' ? 'rgba(167,139,250,0.10)'
                    : mode === 'focus' ? 'rgba(56,189,248,0.10)'
                      : 'rgba(255,255,255,0.05)',
                color: isCinematic ? '#fbbf24'
                  : mode === 'replay' ? '#c4b5fd'
                    : mode === 'focus' ? '#7dd3fc'
                      : 'rgba(255,255,255,0.30)',
                border: `1px solid ${isCinematic ? 'rgba(251,191,36,0.22)'
                  : mode === 'replay' ? 'rgba(167,139,250,0.22)'
                    : mode === 'focus' ? 'rgba(56,189,248,0.22)'
                      : 'rgba(255,255,255,0.08)'}`,
              }}
            >
              {isCinematic ? '🎬 cinematic' : `● ${mode}`}
            </motion.div>
          </AnimatePresence>

          <button
            onClick={() => setShowTraces(true)}
            className="rounded-xl border border-cyan-400/22 bg-cyan-500/[0.06] px-3 py-2 text-xs text-cyan-300 transition hover:bg-cyan-500/[0.12]"
          >
            Inspect traces →
          </button>
        </div>
      </div>

      <div className={`grid gap-5 ${tier === 'expanded' ? 'xl:grid-cols-[minmax(0,1fr)_340px]' : ''}`}>
        <div
          ref={canvasContainerRef}
          className={`relative border border-white/7 bg-[#02091a] shadow-[0_28px_90px_rgba(0,0,0,0.55)] ${isMobile ? 'rounded-[20px] p-2' : 'rounded-[28px] p-3'}`}
          style={{
            touchAction: isMobile ? 'none' : 'auto',
          }}
        >
          <div className="mb-2.5 flex items-center justify-between px-1">
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-rose-400/50" />
              <div className="h-2 w-2 rounded-full bg-amber-300/50" />
              <div className="h-2 w-2 rounded-full bg-emerald-400/50" />
              <span className="ml-2 font-mono text-[11px] tracking-wide text-white/25">topology.canvas</span>
              <AnimatePresence>
                {isCinematic && (
                  <motion.span
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="ml-1 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-widest"
                    style={{ background: 'rgba(251,191,36,0.12)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.25)' }}
                  >
                    ● cinematic
                  </motion.span>
                )}
                {mode === 'replay' && (
                  <motion.span
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="ml-1 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-widest"
                    style={{ background: 'rgba(167,139,250,0.12)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.25)' }}
                  >
                    ▶ replay
                  </motion.span>
                )}
              </AnimatePresence>
            </div>

            {isAnimating && (
              <div className="flex items-center gap-2">
                <span className="text-[10px]" style={{ color: isCinematic ? 'rgba(251,191,36,0.5)' : 'rgba(167,139,250,0.5)' }}>
                  {isCinematic ? 'scene' : 'step'}
                </span>
                <span className="font-mono text-[10px]" style={{ color: isCinematic ? 'rgba(251,191,36,0.7)' : 'rgba(167,139,250,0.7)' }}>
                  {sceneIndex + 1}/{isCinematic ? story.length : replaySeq.length}
                </span>
                <button
                  onClick={() => setMode('normal')}
                  className="ml-1 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] text-white/40 transition hover:bg-white/[0.08] hover:text-white/70"
                >
                  Stop ■
                </button>
              </div>
            )}
          </div>

          <AnimatePresence initial={false}>
            {!isCinematic && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{ duration: 0.18 }}
                className="mb-3 flex justify-center px-2"
              >
                <div className="max-w-full overflow-x-auto">
                  <div
                    className="flex w-max items-center gap-1 rounded-2xl px-2 py-1.5"
                    style={{
                      background: 'rgba(4,10,22,0.88)',
                      border: '1px solid rgba(255,255,255,0.10)',
                      boxShadow: '0 4px 30px rgba(0,0,0,0.60), 0 0 0 1px rgba(255,255,255,0.04)',
                      backdropFilter: 'blur(24px)',
                    }}
                  >
                    {modeButtons.map((m) => {
                      const isAct = mode === m.id;
                      return (
                        <button
                          key={m.id}
                          onClick={() => handleModeChange(m.id)}
                          className="relative flex items-center gap-1.5 rounded-[14px] px-3 py-1.5 text-[11px] font-medium transition-all duration-200"
                          style={{
                            color: isAct ? m.hex : 'rgba(255,255,255,0.40)',
                            background: isAct ? `rgba(${m.rgb},0.12)` : 'transparent',
                            border: isAct ? `1px solid rgba(${m.rgb},0.25)` : '1px solid transparent',
                          }}
                        >
                          <span className="text-[10px]">{m.icon}</span>
                          {m.label}
                          {isAct && isAnimating && (
                            <span className="ml-0.5 text-[9px] opacity-60">✕</span>
                          )}
                        </button>
                      );
                    })}

                    <div className="mx-1 h-5 w-px bg-white/10" />

                    {isAnimating && (
                      <button
                        onClick={() => setMode('normal')}
                        className="flex items-center gap-1 rounded-[14px] px-3 py-1.5 text-[11px] font-medium transition-all duration-200"
                        style={{
                          color: '#fca5a5',
                          background: 'rgba(239,68,68,0.12)',
                          border: '1px solid rgba(239,68,68,0.25)',
                        }}
                      >
                        ⏹ Stop
                      </button>
                    )}

                    <div className="mx-1 h-5 w-px bg-white/10" />

                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={handleZoomOut}
                        className="flex h-6 w-6 items-center justify-center rounded-lg text-[12px] text-white/35 transition hover:bg-white/[0.06] hover:text-white/70"
                      >
                        −
                      </button>
                      <span className="w-9 text-center font-mono text-[10px] text-white/30">
                        {Math.round(zoom * 100)}%
                      </span>
                      <button
                        onClick={handleZoomIn}
                        className="flex h-6 w-6 items-center justify-center rounded-lg text-[12px] text-white/35 transition hover:bg-white/[0.06] hover:text-white/70"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ─── COMPACT (mobile): swap to MobilePathView ───────────── */}
          {isMobile ? (
            <div className="h-viewport-canvas overflow-y-auto rounded-[16px]">
              <MobilePathView nodes={nodes} traces={traces} />
            </div>
          ) : (
          <>
          {/* ─── MEDIUM + EXPANDED: full canvas ──────────────────────── */}
          <div
            ref={viewportRef}
            className={`overflow-auto scroll-smooth ${isMobile ? 'rounded-[16px]' : 'rounded-[20px]'} ${isTablet ? 'canvas-scroll-area' : ''}`}
            style={{
              maxHeight: isTablet ? 'calc(100dvh - 200px)' : undefined,
            }}
          >
            <div style={{ minWidth: isTablet ? 1400 : 2040 }}>
              <motion.div
                className="relative overflow-hidden rounded-[20px] border border-white/5"
                style={{
                  height: CANVAS_H,
                  transformOrigin: 'top left',
                  background: [
                    'radial-gradient(ellipse 50% 35% at 50% 0%, rgba(56,189,248,0.045) 0%, transparent 65%)',
                    'radial-gradient(ellipse 30% 25% at 50% 83%, rgba(251,113,133,0.03) 0%, transparent 60%)',
                    '#010b18',
                  ].join(', '),
                }}
                animate={{
                  // ── Change 3: cinematic zoom now driven per-effectiveId ──
                  // Note: the scale here applies to the whole canvas container,
                  // not per-node. The per-node scale is handled on individual
                  // motion.div nodes below. We keep the global zoom multiplier.
                  scale: isCinematic ? zoom * 1.08 : zoom,
                  filter: isCinematic
                    ? ['brightness(1)', 'brightness(1.04)', 'brightness(1)']
                    : 'brightness(1)',
                }}
                transition={{
                  scale: { duration: 1.2, ease: 'easeInOut' },
                  filter: isCinematic
                    ? { duration: 3, repeat: Infinity, ease: 'easeInOut' }
                    : { duration: 0.3 },
                }}
              >
                <motion.div
                  className="pointer-events-none absolute inset-0"
                  animate={{
                    backgroundPosition: isAnimating
                      ? '0px 0px'
                      : ['0px 0px', '0px 6px', '0px 0px'],
                  }}
                  transition={{
                    duration: 20,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                  style={{
                    backgroundImage: [
                      'linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px)',
                      'linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px)',
                    ].join(','),
                    backgroundSize: '44px 44px',
                  }}
                />

                <CinematicOverlay active={isCinematic} />
                <LetterboxBars active={isCinematic} />
                <CinematicNodeBanner nodeId={effectiveId} visible={isCinematic} />
                <CinematicHUD nodeId={effectiveId} nodeMap={nodeMap} active={isCinematic} />

                <AnimatePresence>
                  {isCinematic && story[sceneIndex] && (
                    <motion.div
                      key={`narration-${sceneIndex}`}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.4 }}
                      className="pointer-events-none absolute bottom-10 left-1/2 z-50 -translate-x-1/2"
                    >
                      <div
                        className="rounded-2xl px-6 py-4 text-center"
                        style={{
                          background: 'rgba(4,10,22,0.88)',
                          backdropFilter: 'blur(24px)',
                          border: `1px solid rgba(${NODE_ACCENT[story[sceneIndex].id]?.rgb ?? '255,255,255'},0.16)`,
                          boxShadow: `0 0 40px rgba(${NODE_ACCENT[story[sceneIndex].id]?.rgb ?? '56,189,248'},0.12), 0 24px 80px rgba(0,0,0,0.80)`,
                          minWidth: 280,
                          maxWidth: 420,
                        }}
                      >
                        <div className="mb-1.5 text-[10px] uppercase tracking-[0.28em] text-white/35">
                          Scene {sceneIndex + 1} of {story.length}
                        </div>
                        <div className="text-[16px] font-semibold leading-snug text-white">
                          {story[sceneIndex].title}
                        </div>
                        <div
                          className="mt-1.5 text-[12px] leading-relaxed"
                          style={{ color: NODE_ACCENT[story[sceneIndex].id]?.hex ?? 'rgba(255,255,255,0.55)' }}
                        >
                          {story[sceneIndex].description}
                        </div>
                        <div className="mt-3 flex items-center justify-center gap-4">
                          <div className="text-center">
                            <div
                              className="text-[13px] font-bold"
                              style={{ color: story[sceneIndex].latency > 300 ? '#fb7185' : NODE_ACCENT[story[sceneIndex].id]?.hex ?? '#38bdf8' }}
                            >
                              {story[sceneIndex].latency} ms
                            </div>
                            <div className="text-[9px] uppercase tracking-wide text-white/30">p95</div>
                          </div>
                          <div className="h-6 w-px bg-white/10" />
                          <div className="text-center">
                            <div
                              className="text-[13px] font-bold"
                              style={{ color: story[sceneIndex].load > 70 ? '#fbbf24' : NODE_ACCENT[story[sceneIndex].id]?.hex ?? '#38bdf8' }}
                            >
                              {story[sceneIndex].load}%
                            </div>
                            <div className="text-[9px] uppercase tracking-wide text-white/30">load</div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {layers.map((l) => (
                  <div key={l.label}>
                    <div
                      className="pointer-events-none absolute inset-x-0 h-px"
                      style={{ top: l.y - 22, background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.055) 15%, rgba(255,255,255,0.055) 85%, transparent 100%)' }}
                    />
                    <div
                      className="pointer-events-none absolute text-[9.5px] font-medium uppercase tracking-[0.24em] text-white/16"
                      style={{ left: 22, top: l.y - 15 }}
                    >
                      {l.label}
                    </div>
                  </div>
                ))}

                <svg
                  className="pointer-events-none absolute inset-0 h-full w-full"
                  viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
                  preserveAspectRatio="xMinYMin meet"
                >
                  <defs>
                    {[
                      { id: 'arr-c', col: '#38bdf8' },
                      { id: 'arr-v', col: '#818cf8' },
                      { id: 'arr-r', col: '#fb7185' },
                      { id: 'arr-g', col: '#34d399' },
                      { id: 'arr-p', col: '#a78bfa' },
                      { id: 'arr-pk', col: '#f472b6' },
                    ].map(({ id, col }) => (
                      <marker key={id} id={id} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="4.5" markerHeight="4.5" orient="auto-start-reverse">
                        <path d="M 0 1.5 L 8.5 5 L 0 8.5 z" fill={col} opacity="0.88" />
                      </marker>
                    ))}
                    <linearGradient id="rail" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="rgba(255,255,255,0.08)" />
                      <stop offset="100%" stopColor="rgba(255,255,255,0.025)" />
                    </linearGradient>
                    {[
                      { id: 'gc', a: '#38bdf8', b: '#818cf8' },
                      { id: 'gr', a: '#818cf8', b: '#fb7185' },
                      { id: 'gg', a: '#38bdf8', b: '#34d399' },
                      { id: 'gv', a: '#818cf8', b: '#a78bfa' },
                      { id: 'gp', a: '#38bdf8', b: '#f472b6' },
                    ].map(({ id, a, b }) => (
                      <linearGradient key={id} id={id} x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor={a} />
                        <stop offset="100%" stopColor={b} />
                      </linearGradient>
                    ))}
                    <filter id="eg">
                      <feGaussianBlur stdDeviation="2" result="b" />
                      <feMerge>
                        <feMergeNode in="b" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                    <filter id="cineGlow" x="-30%" y="-30%" width="160%" height="160%">
                      <feGaussianBlur stdDeviation="6" result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>

                  {isCinematic && (
                    <NodeSpotlight
                      nodeId={effectiveId}
                      color={NODE_ACCENT[effectiveId]?.hex ?? '#38bdf8'}
                      active
                    />
                  )}

                  {GRAPH_EDGES.map(([from, to]) => {
                    const p = getCurvePath(from, to);
                    const k = edgeKey(from, to);
                    const active = activeEdges.has(k);
                    const dimmed = isFocusActive && !active;
                    const gradId = to === 'db' ? 'gr' : to === 'cache' ? 'gg' : to === 'queue' ? 'gv' : to === 'auth' ? 'gp' : 'gc';
                    const arrId = to === 'db' ? 'arr-r' : to === 'cache' ? 'arr-g' : to === 'queue' ? 'arr-p' : to === 'auth' ? 'arr-pk' : 'arr-c';
                    const pColor = NODE_ACCENT[to]?.hex ?? '#38bdf8';

                    // ── Change 4: traffic-intensity-scaled particle duration ──
                    const trafficFactor = Math.max(1, Math.floor(traces.length / 5));
                    const pDur =
                      (to === 'db' ? 2.6 : to === 'cache' ? 2.0 : to === 'queue' ? 2.4 : 2.1) /
                      Math.min(trafficFactor, 3);

                    return (
                      <g key={k}>
                        <path d={p} fill="none" stroke="url(#rail)" strokeWidth="1.5" strokeLinecap="round" opacity={dimmed ? 0.06 : 0.32} />
                        <motion.path
                          d={p}
                          fill="none"
                          stroke={`url(#${gradId})`}
                          strokeWidth={active ? (isCinematic ? 3.2 : 2.6) : 1.2}
                          strokeLinecap="round"
                          strokeDasharray="11 8"
                          filter={active ? (isCinematic ? 'url(#cineGlow)' : 'url(#eg)') : undefined}
                          markerEnd={active ? `url(#${arrId})` : undefined}
                          initial={false}
                          animate={{
                            strokeDashoffset: isAnimating ? [0, -38] : 0,
                            opacity: active ? 1 : dimmed ? 0.04 : 0.12,
                          }}
                          transition={{
                            strokeDashoffset: isAnimating
                              ? {
                                duration: isCinematic
                                  ? (active ? 1.4 : 2.8)
                                  : (active ? 0.85 : 2.0),
                                repeat: Infinity,
                                ease: 'linear',
                              }
                              : { duration: 0.35 },
                            opacity: { duration: 0.3 },
                          }}
                        />
                        {/* ── Change 1: real per-trace request trail particles ── */}
                        {traces.slice(0, 25).map((trace, i) => {
                          const pathNodes = (trace.path ?? []).map(normalizeNodeId);

                          for (let j = 0; j < pathNodes.length - 1; j++) {
                            if (pathNodes[j] === from && pathNodes[j + 1] === to) {
                              const isFailed = (trace as { failed?: boolean }).failed;
                              const isRetry = (trace as { retrying?: boolean }).retrying;

                              return (
                                <FlowParticle
                                  key={`${trace.id}-${j}`}
                                  path={p}
                                  duration={isCinematic ? 2.8 : 2.0}
                                  delay={i * 0.08}
                                  size={isCinematic ? 5 : 3.5}
                                  color={
                                    isFailed
                                      ? '#fb7185'
                                      : isRetry
                                        ? '#fbbf24'
                                        : pColor
                                  }
                                  cinematic={isCinematic}
                                />
                              );
                            }
                          }
                          return null;
                        })}
                      </g>
                    );
                  })}
                </svg>

                {Object.entries(positions).map(([id, pos]) => {
                  const n = nodeMap[id];
                  const acc = NODE_ACCENT[id] ?? { hex: '#38bdf8', rgb: '56,189,248', label: id.toUpperCase(), role: '' };
                  const active = mode === 'normal'
                    ? isActive(id, traces)
                    : effectiveId === id || isActive(id, traces);
                  const hovered = hoveredNodeId === id;
                  const isHero = id === 'service';
                  const { w, h } = getNodeSize(id);
                  const focused = isFocused(id);
                  const sev = getSeverity(n?.load ?? 0, n?.p95Latency ?? 0);
                  const isCrit = sev === 'critical';
                  const load = n?.load ?? 0;
                  const lat = n?.p95Latency ?? 0;

                  // ── Change 2a: bottleneck dominance opacity ──
                  const isLead = id === effectiveId;

                  const focusOpacity = isCinematic
                    ? isLead
                      ? 1
                      : 0.02
                    : focused
                      ? 1
                      : 0.06;

                  const borderCol = active
                    ? `rgba(${acc.rgb},0.50)`
                    : isCrit ? 'rgba(251,113,133,0.28)'
                      : hovered ? `rgba(${acc.rgb},0.28)`
                        : 'rgba(255,255,255,0.07)';

                  const shadowVal = active
                    ? `0 0 0 1px rgba(${acc.rgb},0.22), 0 0 30px rgba(${acc.rgb},0.25), 0 0 70px rgba(${acc.rgb},0.10), 0 24px 60px rgba(0,0,0,0.50)`
                    : isCrit
                      ? '0 0 0 1px rgba(251,113,133,0.16), 0 0 26px rgba(251,113,133,0.18), 0 0 55px rgba(239,68,68,0.45), 0 20px 50px rgba(0,0,0,0.45)'
                      : hovered
                        ? `0 0 0 1px rgba(${acc.rgb},0.20), 0 0 30px rgba(${acc.rgb},0.16), 0 20px 55px rgba(0,0,0,0.50)`
                        : '0 0 0 1px rgba(255,255,255,0.04), 0 12px 40px rgba(0,0,0,0.38)';

                  const activeShadow = isCinematic && active && isCrit
                    ? `0 0 0 2px rgba(${acc.rgb},0.45), 0 0 60px rgba(${acc.rgb},0.55), 0 0 120px rgba(251,113,133,0.30), 0 30px 80px rgba(0,0,0,0.70)`
                    : isCinematic && active
                      ? `0 0 0 2px rgba(${acc.rgb},0.40), 0 0 50px rgba(${acc.rgb},0.45), 0 0 100px rgba(${acc.rgb},0.20), 0 28px 70px rgba(0,0,0,0.65)`
                      : shadowVal;

                  return (
                    <motion.div
                      key={id}
                      className="absolute select-none"
                      style={{
                        left: pos.x,
                        top: pos.y,
                        width: w,
                        height: h,
                        opacity: focusOpacity,
                        // ── Change 2b: bottleneck dominance blur ──
                        filter: isCinematic
                          ? isLead
                            ? 'none'
                            : 'blur(4px)'
                          : focused
                            ? 'none'
                            : 'blur(2px)',
                        transition: 'opacity 0.55s ease, filter 0.55s ease',
                        zIndex: hovered ? 10 : active ? 5 : 1,
                      }}
                      animate={{
                        y: active ? [0, -4, 0] : 0,
                        scale: active && isCinematic
                          ? [1, 1.08, 1.03]
                          : hovered ? (isHero ? 1.042 : 1.035) : 1,
                      }}
                      transition={{
                        y: { duration: isCinematic ? 4.5 : 3.0, repeat: Infinity, ease: 'easeInOut' },
                        scale: {
                          duration: isCinematic ? 2.2 : 0.28,
                          ease: isCinematic ? 'easeInOut' : [0.34, 1.56, 0.64, 1],
                          repeat: isCinematic && active ? Infinity : 0,
                        },
                      }}
                      onMouseEnter={() => setHoveredNodeId(id)}
                      onMouseLeave={() => setHoveredNodeId(null)}
                    >
                      <div
                        className="relative h-full w-full overflow-hidden rounded-[20px]"
                        style={{
                          background: isHero
                            ? `linear-gradient(140deg, rgba(${acc.rgb},0.11) 0%, rgba(8,16,34,0.96) 45%, rgba(4,10,22,0.97) 100%)`
                            : 'linear-gradient(155deg, rgba(255,255,255,0.038) 0%, rgba(6,12,28,0.95) 55%, rgba(3,8,18,0.97) 100%)',
                          border: `1px solid ${borderCol}`,
                          boxShadow: activeShadow,
                          backdropFilter: 'blur(22px)',
                          transition: 'border-color 0.32s ease, box-shadow 0.55s ease',
                        }}
                      >
                        <div
                          className="absolute bottom-[10%] left-0 top-[10%] w-[3px] rounded-r-full"
                          style={{
                            background: `linear-gradient(180deg, ${acc.hex}bb 0%, ${acc.hex}33 100%)`,
                            opacity: active ? 1 : isCrit ? 0.85 : hovered ? 0.7 : 0.38,
                            transition: 'opacity 0.3s ease',
                          }}
                        />
                        <div
                          className="pointer-events-none absolute inset-x-0 top-0 h-10 rounded-t-[20px]"
                          style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, transparent 100%)' }}
                        />

                        {active && (
                          <motion.div
                            className="pointer-events-none absolute inset-0 rounded-[20px]"
                            animate={{ opacity: isCinematic ? [0.10, 0.40, 0.10] : [0.10, 0.26, 0.10] }}
                            transition={{ duration: isCinematic ? 3.5 : 2.2, repeat: Infinity, ease: 'easeInOut' }}
                            style={{ background: `radial-gradient(ellipse at 50% 0%, rgba(${acc.rgb},0.18) 0%, transparent 60%)` }}
                          />
                        )}

                        {!isAnimating && (
                          <motion.div
                            className="pointer-events-none absolute inset-0 rounded-[20px]"
                            animate={{ opacity: [0.04, 0.08, 0.04] }}
                            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                            style={{
                              background: `radial-gradient(circle at 50% 0%, rgba(${acc.rgb},0.12), transparent 60%)`,
                            }}
                          />
                        )}

                        {isCrit && (
                          <motion.div
                            className="pointer-events-none absolute inset-0 rounded-[20px]"
                            animate={{ opacity: [0, isCinematic ? 0.35 : 0.20, 0] }}
                            transition={{ duration: isCinematic ? 1.8 : 1.3, repeat: Infinity, ease: 'easeInOut' }}
                            style={{ background: 'radial-gradient(ellipse at 50% 50%, rgba(239,68,68,0.22) 0%, transparent 65%)' }}
                          />
                        )}

                        {/* ── Change 5: critical node pulse ring in cinematic mode ── */}
                        {isCrit && isCinematic && (
                          <motion.div
                            className="absolute inset-0 rounded-[20px]"
                            animate={{
                              scale: [1, 1.08, 1],
                              opacity: [0.2, 0.5, 0.2],
                            }}
                            transition={{
                              duration: 1.2,
                              repeat: Infinity,
                              ease: 'easeInOut',
                            }}
                            style={{
                              border: '1px solid rgba(239,68,68,0.4)',
                              boxShadow: '0 0 40px rgba(239,68,68,0.6)',
                            }}
                          />
                        )}

                        <div className="relative flex h-full flex-col px-[18px] py-3.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="mb-0.5 flex items-center gap-2">
                                <PulseDot color={acc.hex} active={active} isAnimating={isAnimating} />
                                <div className="truncate text-[13px] font-semibold leading-snug text-white">
                                  {n?.label ?? acc.label}
                                </div>
                                {isHero && (
                                  <div
                                    className="flex-shrink-0 rounded-full px-1.5 py-[2px] text-[8px] font-semibold uppercase tracking-wider"
                                    style={{ background: `rgba(${acc.rgb},0.14)`, color: acc.hex, border: `1px solid rgba(${acc.rgb},0.22)` }}
                                  >
                                    core
                                  </div>
                                )}
                              </div>
                              <div className="pl-[18px] text-[10px] leading-none text-white/35">{acc.role}</div>
                            </div>
                            <div
                              className="flex-shrink-0 rounded-full px-2 py-[3px] text-[8.5px] font-bold uppercase tracking-wider"
                              style={{
                                background: isCrit ? 'rgba(239,68,68,0.14)' : sev === 'elevated' ? 'rgba(245,158,11,0.12)' : `rgba(${acc.rgb},0.10)`,
                                color: isCrit ? '#fca5a5' : sev === 'elevated' ? '#fcd34d' : acc.hex,
                                border: `1px solid ${isCrit ? 'rgba(239,68,68,0.22)' : sev === 'elevated' ? 'rgba(245,158,11,0.18)' : `rgba(${acc.rgb},0.16)`}`,
                              }}
                            >
                              {isCrit ? 'crit' : sev === 'elevated' ? 'high' : 'ok'}
                            </div>
                          </div>

                          <div
                            className="my-3 h-px"
                            style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.065) 25%, rgba(255,255,255,0.065) 75%, transparent)' }}
                          />

                          <div className="flex items-end gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="mb-1.5 flex items-center justify-between">
                                <span className="text-[9px] font-medium uppercase tracking-widest text-white/30">Load</span>
                                <span className="text-[11px] font-bold text-white/85">{pct(load)}</span>
                              </div>
                              <LoadBar load={load} color={acc.hex} />
                            </div>
                            <LatencyRing latency={lat} color={isCrit ? '#fb7185' : acc.hex} />
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}

                <AnimatePresence>
                  {hoveredNodeId && nodeMap[hoveredNodeId] && (() => {
                    const hPos = positions[hoveredNodeId];
                    const { w } = getNodeSize(hoveredNodeId);
                    const acc = NODE_ACCENT[hoveredNodeId];
                    const n = nodeMap[hoveredNodeId];
                    const sev = getSeverity(n?.load ?? 0, n?.p95Latency ?? 0);
                    const ttLeft = hPos.x + w + 14 + 240 < CANVAS_W ? hPos.x + w + 14 : hPos.x - 250;
                    const ttTop = Math.max(10, hPos.y);

                    return (
                      <motion.div
                        className="pointer-events-none absolute z-30"
                        initial={{ opacity: 0, x: -6, scale: 0.96 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: -6, scale: 0.96 }}
                        transition={{ duration: 0.15 }}
                        style={{ left: ttLeft, top: ttTop, width: 232 }}
                      >
                        <div
                          className="overflow-hidden rounded-[18px]"
                          style={{
                            background: 'rgba(5,11,26,0.97)',
                            border: `1px solid rgba(${acc?.rgb ?? '255,255,255'},0.13)`,
                            boxShadow: `0 0 0 1px rgba(255,255,255,0.04), 0 0 28px rgba(${acc?.rgb ?? '56,189,248'},0.08), 0 24px 70px rgba(0,0,0,0.82)`,
                            backdropFilter: 'blur(28px)',
                          }}
                        >
                          <div
                            className="px-4 py-3"
                            style={{
                              background: `linear-gradient(135deg, rgba(${acc?.rgb ?? '56,189,248'},0.12) 0%, transparent 100%)`,
                              borderBottom: `1px solid rgba(${acc?.rgb ?? '255,255,255'},0.07)`,
                            }}
                          >
                            <div className="mb-1 text-[9px] uppercase tracking-[0.24em]" style={{ color: acc?.hex ?? '#38bdf8' }}>node insight</div>
                            <div className="text-[13px] font-semibold text-white">{n?.label ?? acc?.label}</div>
                          </div>
                          <div className="grid grid-cols-2 gap-2 p-3">
                            {[['Load', pct(n?.load)], ['p95', ms(n?.p95Latency)]].map(([k, v]) => (
                              <div
                                key={k}
                                className="rounded-[10px] px-3 py-2.5"
                                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                              >
                                <div className="mb-0.5 text-[9px] text-white/45">{k}</div>
                                <div className="text-[13px] font-bold text-white">{v}</div>
                              </div>
                            ))}
                          </div>
                          <div className="space-y-1.5 px-3 pb-3">
                            <div
                              className="flex items-center justify-between rounded-[10px] px-3 py-2"
                              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                            >
                              <span className="text-[9px] text-white/40">Severity</span>
                              <span className="text-[10px] font-bold" style={{ color: sev === 'critical' ? '#fca5a5' : sev === 'elevated' ? '#fcd34d' : '#6ee7b7' }}>
                                {sev}
                              </span>
                            </div>
                            <div
                              className="rounded-[10px] px-3 py-2 text-[10px] leading-relaxed text-white/45"
                              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}
                            >
                              {HOVER_HINTS[hoveredNodeId] ?? 'Monitor traffic patterns and latency.'}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })()}
                </AnimatePresence>
              </motion.div>
            </div>
          </div>
          </>
          )}

          {/* ─── Floating Start / Pause Toggle Bar ──────────────────────── */}
          <FloatingSimControls />
        </div>

        {/* Sidebar — only on expanded (desktop) */}
        {tier === 'expanded' && (
        <aside className="space-y-4">
          <div className="rounded-[24px] border border-white/7 bg-[#060d1f]/95 p-5 shadow-[0_12px_50px_rgba(0,0,0,0.60)] backdrop-blur-xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <div className="mb-1.5 text-[9.5px] uppercase tracking-[0.28em] text-cyan-400/65">AI diagnosis</div>
                <div className="text-[14.5px] font-semibold leading-snug text-white">{insight.title}</div>
              </div>
              <div
                className="flex-shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium text-cyan-300"
                style={{ background: 'rgba(34,211,238,0.07)', border: '1px solid rgba(34,211,238,0.16)' }}
              >
                ● live
              </div>
            </div>
            <p className="mb-4 text-[11.5px] leading-[1.75] text-white/50">{insight.summary}</p>
            <div className="space-y-2">
              {insight.bullets.map((b) => (
                <div
                  key={b}
                  className="flex items-start gap-2.5 rounded-xl px-3.5 py-2.5"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.065)' }}
                >
                  <div className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-cyan-400/45" />
                  <span className="text-[11.5px] leading-relaxed text-white/65">{b}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[24px] border border-white/7 bg-[#060d1f]/95 p-5 shadow-[0_12px_50px_rgba(0,0,0,0.60)] backdrop-blur-xl">
            <div className="mb-4 text-[9.5px] uppercase tracking-[0.28em] text-white/35">Request storyline</div>
            <div className="space-y-2">
              {timeline.map((ev) => {
                const acc = NODE_ACCENT[ev.id];
                const hi = ev.id === effectiveId;
                const crit = ev.severity === 'critical';

                return (
                  <div
                    key={ev.id}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200"
                    style={{
                      background: hi ? `rgba(${acc?.rgb ?? '56,189,248'},0.07)` : crit ? 'rgba(251,113,133,0.05)' : 'rgba(255,255,255,0.025)',
                      border: `1px solid ${hi ? `rgba(${acc?.rgb ?? '56,189,248'},0.20)` : crit ? 'rgba(251,113,133,0.13)' : 'rgba(255,255,255,0.055)'}`,
                    }}
                  >
                    <div
                      className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-semibold"
                      style={{
                        background: hi ? `rgba(${acc?.rgb ?? '56,189,248'},0.16)` : 'rgba(255,255,255,0.055)',
                        color: hi ? acc?.hex ?? '#38bdf8' : 'rgba(255,255,255,0.35)',
                        border: `1px solid ${hi ? `rgba(${acc?.rgb ?? '56,189,248'},0.26)` : 'rgba(255,255,255,0.08)'}`,
                      }}
                    >
                      {ev.step}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[11.5px] font-medium text-white">{ev.label}</div>
                      <div className="text-[10px] text-white/35">{ev.load}% · {ev.latency} ms</div>
                    </div>
                    <div
                      className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                      style={{
                        backgroundColor: crit ? '#fb7185' : ev.severity === 'elevated' ? '#fbbf24' : acc?.hex ?? '#38bdf8',
                        opacity: 0.65,
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
        )}
      </div>

      <AnimatePresence>
        {showTraces && (
          <motion.div
            className="fixed inset-0 z-50 flex justify-end"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/62 backdrop-blur-sm" onClick={() => setShowTraces(false)} />
            <motion.div
              initial={{ x: 440 }}
              animate={{ x: 0 }}
              exit={{ x: 440 }}
              transition={{ type: 'spring', stiffness: 220, damping: 26 }}
              className="relative z-10 h-full w-full max-w-[420px] overflow-y-auto border-l border-white/7 bg-[#050c1e] p-5 shadow-2xl"
            >
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <div className="mb-1.5 text-[9.5px] uppercase tracking-[0.28em] text-cyan-400/65">Trace inspector</div>
                  <div className="text-[15px] font-semibold text-white">Inspect request paths</div>
                </div>
                <button
                  onClick={() => setShowTraces(false)}
                  className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] text-white/60 transition hover:bg-white/[0.08]"
                >
                  Close ✕
                </button>
              </div>

              <div className="space-y-2.5">
                {traces.slice(0, 12).map((trace, i) => {
                  const tid = String(trace.id ?? `trace-${i}`);
                  const isSel = selectedTrace === tid;
                  const isCli = clickedTrace === tid;
                  const path = Array.isArray(trace.path) ? trace.path : [];
                  const maxL = Math.max(0, ...path.map((id) => Math.round(nodeMap[normalizeNodeId(id)]?.p95Latency ?? 0)));

                  return (
                    <div
                      key={tid}
                      onClick={() => {
                        setSelectedTrace(tid);
                        setClickedTrace((p) => p === tid ? null : tid);
                      }}
                      className="cursor-pointer overflow-hidden rounded-2xl transition-all duration-200"
                      style={{
                        border: isCli ? '1px solid rgba(167,139,250,0.32)' : isSel ? '1px solid rgba(56,189,248,0.28)' : '1px solid rgba(255,255,255,0.065)',
                        background: isCli ? 'rgba(139,92,246,0.07)' : isSel ? 'rgba(56,189,248,0.055)' : 'rgba(255,255,255,0.025)',
                      }}
                    >
                      <div className="flex items-start justify-between gap-3 p-4">
                        <div>
                          <div className="text-[13px] font-semibold text-white">Request {tid}</div>
                          <div className="mt-0.5 text-[11px] text-white/40">{traceStatus(trace)} · {traceLatency(trace, nodeMap)} ms</div>
                        </div>
                        <div className="flex flex-shrink-0 items-center gap-1.5">
                          {isCli && (
                            <div
                              className="rounded-full px-2 py-0.5 text-[9.5px] font-medium"
                              style={{ background: 'rgba(167,139,250,0.14)', color: '#c4b5fd', border: '1px solid rgba(167,139,250,0.22)' }}
                            >
                              live
                            </div>
                          )}
                          <div
                            className="rounded-full px-2.5 py-0.5 text-[10px] text-white/45"
                            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                          >
                            {path.length} hops
                          </div>
                        </div>
                      </div>
                      {isSel && path.length > 0 && (
                        <div className="space-y-1.5 px-4 pb-4">
                          {path.map((nodeId, j) => {
                            const nid = normalizeNodeId(nodeId);
                            const n = nodeMap[nid];
                            const lat = Math.round(n?.p95Latency ?? 0);
                            const acc = NODE_ACCENT[nid];
                            const bot = lat === maxL && lat > 0;

                            return (
                              <div
                                key={`${tid}-${nodeId}-${j}`}
                                className="flex items-center justify-between rounded-[10px] px-3 py-2 text-[11px]"
                                style={{
                                  background: bot ? 'rgba(239,68,68,0.09)' : 'rgba(255,255,255,0.035)',
                                  border: `1px solid ${bot ? 'rgba(239,68,68,0.20)' : `rgba(${acc?.rgb ?? '255,255,255'},0.07)`}`,
                                }}
                              >
                                <div className="flex items-center gap-2">
                                  <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: bot ? '#fb7185' : acc?.hex ?? '#38bdf8' }} />
                                  <span className="text-white/65">{n?.label ?? nid.toUpperCase()}</span>
                                </div>
                                <span className="font-semibold" style={{ color: bot ? '#fca5a5' : 'rgba(255,255,255,0.55)' }}>{lat} ms</span>
                              </div>
                            );
                          })}
                          <div
                            className="mt-1.5 rounded-[10px] px-3 py-2 text-[10px] text-cyan-200/55"
                            style={{ background: 'rgba(34,211,238,0.04)', border: '1px solid rgba(34,211,238,0.09)' }}
                          >
                            Click a request to isolate its path on the canvas.
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                {traces.length === 0 && (
                  <div
                    className="rounded-2xl px-4 py-6 text-center text-[13px] text-white/35"
                    style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.065)' }}
                  >
                    No traces yet. Start the simulation.
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

export default FlowCanvas;