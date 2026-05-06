export const CARD_W = 220;
export const CARD_H = 158;
export const HERO_W = 260;
export const HERO_H = 174;
export const CANVAS_W = 2000;
export const CANVAS_H = 1100;

export const positions: Record<string, { x: number; y: number }> = {
  edge: { x: 890, y: 60 },
  gateway: { x: 890, y: 250 },
  auth: { x: 450, y: 460 },
  router: { x: 1330, y: 460 },
  cache: { x: 150, y: 670 },
  service: { x: 870, y: 670 },
  queue: { x: 1590, y: 670 },
  db: { x: 870, y: 900 },
};

export const layers = [
  { label: 'Client / Edge', y: 60 },
  { label: 'Gateway', y: 250 },
  { label: 'Auth & Routing', y: 460 },
  { label: 'Services Layer', y: 670 },
  { label: 'Data Layer', y: 900 },
];

export const GRAPH_EDGES = [
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

export const NODE_ACCENT: Record<string, { hex: string; rgb: string; label: string; role: string }> = {
  edge: { hex: '#38bdf8', rgb: '56,189,248', label: 'Edge', role: 'Ingress + CDN' },
  gateway: { hex: '#818cf8', rgb: '129,140,248', label: 'Gateway', role: 'Rate limit + routing' },
  auth: { hex: '#f472b6', rgb: '244,114,182', label: 'Auth', role: 'JWT + ACL' },
  router: { hex: '#a78bfa', rgb: '167,139,250', label: 'Router', role: 'Request fan-out' },
  cache: { hex: '#34d399', rgb: '52,211,153', label: 'Cache', role: 'Fast reads' },
  service: { hex: '#38bdf8', rgb: '56,189,248', label: 'Core Service', role: 'Business logic' },
  queue: { hex: '#a78bfa', rgb: '167,139,250', label: 'Queue', role: 'Async backpressure' },
  db: { hex: '#fb7185', rgb: '251,113,133', label: 'Database', role: 'Persistent state' },
};

export const HOVER_HINTS: Record<string, string> = {
  db: 'Check query plans, index coverage, write amplification.',
  service: 'Profile hot handlers and downstream fan-out.',
  cache: 'Inspect hit ratio, TTLs, and eviction pressure.',
  queue: 'Consumer saturation or growing message backlog.',
  auth: 'External identity calls or expensive policy evaluation.',
  gateway: 'Rate limit buckets, timeouts, or upstream saturation.',
  router: 'Fan-out factor or traffic imbalance across upstreams.',
  edge: 'CDN miss rate, TLS overhead, or origin latency.',
};
