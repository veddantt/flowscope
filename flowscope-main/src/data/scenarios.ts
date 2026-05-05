import type { NodeId, NodeState, ScenarioConfig } from '../types/simulation';

export const PIPELINE: NodeId[] = ['edge', 'gateway', 'auth', 'router', 'cache', 'service', 'queue', 'db'];

export const INITIAL_NODES: NodeState[] = [
  { id: 'edge', label: 'Edge', x: 40, y: 70, role: 'Ingress + CDN', load: 38, errorRate: 0.2, p95Latency: 44 },
  { id: 'gateway', label: 'API Gateway', x: 220, y: 70, role: 'Rate limit + routing', load: 44, errorRate: 0.3, p95Latency: 62 },
  { id: 'auth', label: 'Auth', x: 400, y: 70, role: 'JWT + ACL', load: 34, errorRate: 0.5, p95Latency: 74 },
  { id: 'router', label: 'Router', x: 580, y: 70, role: 'Request fan-out', load: 40, errorRate: 0.4, p95Latency: 58 },
  { id: 'cache', label: 'Cache', x: 760, y: 16, role: 'Fast reads', load: 31, errorRate: 0.2, p95Latency: 28 },
  { id: 'service', label: 'Core Service', x: 760, y: 126, role: 'Business logic', load: 57, errorRate: 0.7, p95Latency: 132 },
  { id: 'queue', label: 'Queue', x: 960, y: 126, role: 'Backpressure + async', load: 50, errorRate: 0.4, p95Latency: 92 },
  { id: 'db', label: 'Database', x: 1160, y: 126, role: 'Persistent state', load: 49, errorRate: 0.6, p95Latency: 141 },
];

export const SCENARIOS: ScenarioConfig[] = [
  {
    id: 'steady',
    label: 'Steady Traffic',
    description: 'Healthy flow with balanced latency and occasional retries.',
    traffic: 1,
    failureBoost: 0,
    latencyBoost: 0,
    queuePressure: 0,
  },
  {
    id: 'launch',
    label: 'Product Launch Spike',
    description: 'Sudden traffic burst stressing gateway, service, and queue.',
    traffic: 1.9,
    failureBoost: 0.8,
    latencyBoost: 0.5,
    queuePressure: 0.7,
  },
  {
    id: 'degraded',
    label: 'Database Degradation',
    description: 'Tail latency grows, retries increase, and root-cause hints appear.',
    traffic: 1.2,
    failureBoost: 1.4,
    latencyBoost: 1.1,
    queuePressure: 1.2,
  },
  {
    id: 'recovery',
    label: 'Recovery Window',
    description: 'Queue drains and latency trends back to normal after mitigation.',
    traffic: 0.9,
    failureBoost: -0.3,
    latencyBoost: -0.2,
    queuePressure: -0.5,
  },
];
