import { INITIAL_NODES, PIPELINE, SCENARIOS } from '../data/scenarios';
import { clamp } from '../lib/format';
import type { MetricsSnapshot, NodeId, NodeState, ScenarioConfig, ScenarioId, SimRequest, TimelinePoint } from '../types/simulation';

export type EngineState = {
  tick: number;
  requestsById: Record<string, SimRequest>;
  completed: SimRequest[];
  nodes: NodeState[];
  metrics: MetricsSnapshot;
  metricHistory: TimelinePoint[];
};

const NODE_BASE_MS: Record<NodeId, number> = {
  edge: 20,
  gateway: 32,
  auth: 46,
  router: 28,
  cache: 18,
  service: 84,
  queue: 54,
  db: 110,
};

const ROOT_CAUSES: Record<NodeId, string> = {
  edge: 'Traffic surge at the edge increased request burstiness.',
  gateway: 'Gateway saturation caused admission delays and queueing.',
  auth: 'Authentication checks slowed due to elevated token validation load.',
  router: 'Routing fan-out created uneven request distribution.',
  cache: 'Cache misses forced more requests into the core service path.',
  service: 'Core service CPU pressure increased processing time and retries.',
  queue: 'Async queue depth rose faster than consumers could drain it.',
  db: 'Database contention increased lock wait and tail latency.',
};

const initialMetrics: MetricsSnapshot = {
  throughput: 184,
  errorRate: 0.8,
  avgLatency: 118,
  p95Latency: 186,
  inflight: 0,
  successRate: 99.2,
};

export const createInitialEngineState = (): EngineState => ({
  tick: 0,
  requestsById: {},
  completed: [],
  nodes: INITIAL_NODES,
  metrics: initialMetrics,
  metricHistory: [{ tick: 0, ...initialMetrics }],
});

const getScenario = (id: ScenarioId): ScenarioConfig => SCENARIOS.find((s) => s.id === id) ?? SCENARIOS[0];

const randomId = () => Math.random().toString(36).slice(2, 9).toUpperCase();

const jitter = (amount: number) => (Math.random() - 0.5) * amount;

function createRequest(nowTick: number): SimRequest {
  const first = PIPELINE[0];
  return {
    id: `REQ-${randomId()}`,
    createdAt: nowTick,
    updatedAt: nowTick,
    currentNodeId: first,
    path: [first],
    status: 'active',
    progress: 0,
    retries: 0,
    latencyMs: 0,
    etaMs: 0,
    steps: [{ nodeId: first, enteredAt: nowTick }],
    rootCause: undefined,
  };
}

function getFailureChance(nodeId: NodeId, scenario: ScenarioConfig) {
  const base = {
    edge: 0.001,
    gateway: 0.003,
    auth: 0.004,
    router: 0.003,
    cache: 0.002,
    service: 0.008,
    queue: 0.006,
    db: 0.009,
  }[nodeId];

  const dbBias = nodeId === 'db' ? 0.004 : 0;
  const queueBias = nodeId === 'queue' ? scenario.queuePressure * 0.002 : 0;
  return clamp(base + scenario.failureBoost * 0.003 + dbBias + queueBias, 0.0005, 0.08);
}

function getNodeDuration(nodeId: NodeId, scenario: ScenarioConfig) {
  const base = NODE_BASE_MS[nodeId];
  const multiplier = 1 + scenario.latencyBoost * (nodeId === 'service' || nodeId === 'db' || nodeId === 'queue' ? 0.7 : 0.35);
  return Math.max(10, base * multiplier + jitter(12));
}

function advanceRequest(req: SimRequest, tick: number, scenario: ScenarioConfig): SimRequest | null {
  const currentIndex = PIPELINE.indexOf(req.currentNodeId);
  const currentStep = req.steps[req.steps.length - 1];
  const duration = getNodeDuration(req.currentNodeId, scenario);
  const failed = Math.random() < getFailureChance(req.currentNodeId, scenario);

  currentStep.leftAt = tick;
  currentStep.durationMs = duration;
  req.latencyMs += duration;
  req.updatedAt = tick;

  if (failed) {
    if (req.retries < 1 && req.currentNodeId !== 'db') {
      currentStep.outcome = 'retry';
      req.retries += 1;
      req.status = 'retrying';
      req.rootCause = ROOT_CAUSES[req.currentNodeId];
      req.steps.push({ nodeId: req.currentNodeId, enteredAt: tick });
      req.etaMs = duration + 40;
      return req;
    }

    currentStep.outcome = 'failed';
    req.status = 'failed';
    req.progress = 100;
    req.rootCause = ROOT_CAUSES[req.currentNodeId];
    req.etaMs = 0;
    return req;
  }

  currentStep.outcome = 'ok';

  if (currentIndex === PIPELINE.length - 1) {
    req.status = 'success';
    req.progress = 100;
    req.etaMs = 0;
    return req;
  }

  const nextNode = PIPELINE[currentIndex + 1];
  req.previousNodeId = req.currentNodeId;
  req.currentNodeId = nextNode;
  req.path.push(nextNode);
  req.steps.push({ nodeId: nextNode, enteredAt: tick });
  req.progress = ((currentIndex + 1) / (PIPELINE.length - 1)) * 100;
  req.status = 'active';
  req.etaMs = (PIPELINE.length - currentIndex - 1) * 32;
  return req;
}

function updateNodes(existing: NodeState[], scenario: ScenarioConfig, inflight: number): NodeState[] {
  return existing.map((node) => {
    const intensity = scenario.traffic * 8 + inflight * 0.14;
    const queueBias = node.id === 'queue' ? scenario.queuePressure * 8 : 0;
    const dbBias = node.id === 'db' ? scenario.latencyBoost * 9 : 0;
    const serviceBias = node.id === 'service' ? scenario.traffic * 6 : 0;
    const load = clamp(node.load * 0.76 + intensity + queueBias + dbBias + serviceBias + jitter(8), 10, 99);
    const errorRate = clamp((load - 40) / 125 + scenario.failureBoost * 0.6 + (node.id === 'db' ? 0.25 : 0) + jitter(0.12), 0.1, 18);
    const p95Latency = clamp(node.p95Latency * 0.7 + NODE_BASE_MS[node.id] * (1 + load / 75 + scenario.latencyBoost * 0.8) + jitter(14), 18, 540);

    return { ...node, load, errorRate, p95Latency };
  });
}

export function tickEngine(state: EngineState, scenarioId: ScenarioId): EngineState {
  const tick = state.tick + 1;
  const scenario = getScenario(scenarioId);
  const requestsById = { ...state.requestsById };
  const completed = [...state.completed];

  const spawnCount = Math.max(1, Math.round(scenario.traffic * (1 + Math.random() * 1.5)));
  for (let i = 0; i < spawnCount; i += 1) {
    const req = createRequest(tick);
    requestsById[req.id] = req;
  }

  Object.values(requestsById).forEach((req) => {
    const updated = advanceRequest({ ...req, steps: req.steps.map((step) => ({ ...step })) }, tick, scenario);
    if (!updated) return;
    if (updated.status === 'success' || updated.status === 'failed') {
      completed.unshift(updated);
      delete requestsById[updated.id];
      return;
    }
    requestsById[updated.id] = updated;
  });

  const inflight = Object.keys(requestsById).length;
  const recent = completed.slice(0, 80);
  const failures = recent.filter((r) => r.status === 'failed').length;
  const avgLatency = recent.length ? recent.reduce((acc, r) => acc + r.latencyMs, 0) / recent.length : state.metrics.avgLatency;
  const sortedLatencies = recent.map((r) => r.latencyMs).sort((a, b) => a - b);
  const p95Latency = sortedLatencies.length
    ? sortedLatencies[Math.min(sortedLatencies.length - 1, Math.floor(sortedLatencies.length * 0.95))]
    : state.metrics.p95Latency;
  const throughput = Math.round((recent.filter((r) => r.status === 'success').length / Math.max(1, recent.length)) * 230 * scenario.traffic);
  const errorRate = recent.length ? (failures / recent.length) * 100 : state.metrics.errorRate;
  const successRate = clamp(100 - errorRate, 0, 100);

  const nodes = updateNodes(state.nodes, scenario, inflight);
  const metrics: MetricsSnapshot = {
    throughput,
    errorRate,
    avgLatency,
    p95Latency,
    inflight,
    successRate,
  };

  const metricHistory = [...state.metricHistory, { tick, ...metrics }].slice(-40);

  return {
    tick,
    requestsById,
    completed: completed.slice(0, 120),
    nodes,
    metrics,
    metricHistory,
  };
}
