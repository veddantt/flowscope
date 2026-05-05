export type NodeId =
  | 'edge'
  | 'gateway'
  | 'auth'
  | 'router'
  | 'cache'
  | 'service'
  | 'queue'
  | 'db';

export type ScenarioId = 'steady' | 'launch' | 'degraded' | 'recovery';

export type RequestStatus = 'active' | 'success' | 'failed' | 'retrying';

export type NodeState = {
  id: NodeId;
  label: string;
  x: number;
  y: number;
  role: string;
  load: number;
  errorRate: number;
  p95Latency: number;
};

export type RequestTraceStep = {
  nodeId: NodeId;
  enteredAt: number;
  leftAt?: number;
  durationMs?: number;
  outcome?: 'ok' | 'failed' | 'retry';
};

export type SimRequest = {
  totalLatency: any;
  id: string;
  createdAt: number;
  updatedAt: number;
  currentNodeId: NodeId;
  previousNodeId?: NodeId;
  path: NodeId[];
  status: RequestStatus;
  progress: number;
  retries: number;
  latencyMs: number;
  etaMs: number;
  steps: RequestTraceStep[];
  rootCause?: string;
};

export type MetricsSnapshot = {
  throughput: number;
  errorRate: number;
  avgLatency: number;
  p95Latency: number;
  inflight: number;
  successRate: number;
};

export type TimelinePoint = MetricsSnapshot & {
  tick: number;
};

export type ScenarioConfig = {
  id: ScenarioId;
  label: string;
  description: string;
  traffic: number;
  failureBoost: number;
  latencyBoost: number;
  queuePressure: number;
};
