import type { NodeState, SimRequest } from '@/types/simulation';
import { positions, HERO_W, HERO_H, CARD_W, CARD_H, NODE_ACCENT } from './constants';

export function normalizeNodeId(id?: string) {
  const k = String(id ?? '').toLowerCase().trim();
  if (k === 'core') return 'service';
  if (k === 'database') return 'db';
  return k;
}

export function getNodeSize(id: string) {
  return id === 'service' ? { w: HERO_W, h: HERO_H } : { w: CARD_W, h: CARD_H };
}

export function isActive(nodeId: string, traces: SimRequest[]) {
  return traces.some((t) => normalizeNodeId(t.currentNodeId) === normalizeNodeId(nodeId));
}

export function getCurvePath(fromId: string, toId: string, straight = false) {
  const from = positions[fromId];
  const to = positions[toId];
  if (!from || !to) return '';
  const { w: fw, h: fh } = getNodeSize(fromId);
  const { w: tw } = getNodeSize(toId);
  const sx = from.x + fw / 2, sy = from.y + fh;
  const ex = to.x + tw / 2, ey = to.y;
  if (straight) return `M ${sx} ${sy} L ${ex} ${ey}`;
  const my = (sy + ey) / 2;
  return `M ${sx} ${sy} C ${sx} ${my}, ${ex} ${my}, ${ex} ${ey}`;
}

export function pct(v?: number) { return `${Math.round(v ?? 0)}%`; }
export function ms(v?: number) { return `${Math.round(v ?? 0)} ms`; }

export function getSeverity(load = 0, latency = 0) {
  const s = load * 0.35 + latency * 0.65;
  return s >= 320 ? 'critical' : s >= 180 ? 'elevated' : 'healthy';
}

export function edgeKey(a: string, b: string) { return `${a}-${b}`; }

export function getActiveEdges(lead: string) {
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

export function buildReplaySeq(traces: SimRequest[]) {
  const ids = [...new Set(traces.map((t) => normalizeNodeId(t.currentNodeId)).filter(Boolean))];
  return ids.length > 0 ? ids : ['edge', 'gateway', 'auth', 'router', 'service', 'queue', 'db'];
}

export function buildInsight(nodeMap: Record<string, NodeState>, leadId: string) {
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

export function getTimeline(nodeMap: Record<string, NodeState>) {
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

export function traceLatency(trace: SimRequest, nodeMap: Record<string, NodeState>) {
  if (typeof trace.latencyMs === 'number') return Math.round(trace.latencyMs);
  if (Array.isArray(trace.path)) return trace.path.reduce((s, id) => s + Math.round(nodeMap[normalizeNodeId(id)]?.p95Latency ?? 0), 0);
  return 0;
}

export function traceStatus(trace: SimRequest) {
  if ((trace as { failed?: boolean }).failed) return 'Failed';
  if ((trace as { retrying?: boolean }).retrying) return 'Retrying';
  return trace.status ?? 'Active';
}
