import type { MetricsSnapshot, NodeState, ScenarioId, SimRequest, TimelinePoint } from '../types/simulation';

const rankNodes = (nodes: NodeState[]) => {
  return [...nodes]
    .sort((a, b) => b.errorRate * 100 + b.p95Latency + b.load - (a.errorRate * 100 + a.p95Latency + a.load));
};

export function buildAISummary(
  metrics: MetricsSnapshot,
  nodes: NodeState[],
  lead: SimRequest | null,
  scenarioId: ScenarioId,
) {
  const ranked = rankNodes(nodes);
  const top = ranked[0];
  const second = ranked[1];

  if (metrics.errorRate > 5.5) {
    return {
      title: 'High-severity incident pattern detected',
      body: `Failure pressure is elevated under ${scenarioId} conditions. ${top.label} is contributing the strongest combined latency and error signal, with ${second?.label ?? 'a downstream dependency'} also trending hot. The current trace pattern suggests retries are amplifying queue pressure instead of clearing it.`,
      recommendation: `Reduce traffic or shed non-critical requests, then inspect ${top.label}. Use the trace explorer to confirm whether requests stall before or after ${lead?.currentNodeId ?? top.id}.`,
    };
  }

  if (metrics.p95Latency > 240) {
    return {
      title: 'Latency regression building in the tail',
      body: `Median behavior is still survivable, but tail latency is stretching. ${top.label} is the loudest bottleneck right now, and ${lead?.currentNodeId ? `the lead request is currently crossing ${lead.currentNodeId}` : 'request timing suggests a saturated service tier'} which aligns with the observed p95 increase.`,
      recommendation: `Compare the trend chart before and after the scenario shift. Prioritize ${top.label}, then watch queue behavior to see whether the delay is burst-driven or persistent.`,
    };
  }

  return {
    title: 'System is operating within expected bounds',
    body: `Throughput is stable, success rate remains strong, and no node is showing a multi-signal anomaly. ${top.label} is currently the busiest tier, but the broader topology is still absorbing load cleanly.`,
    recommendation: 'Use the scenario buttons to trigger a spike or degradation event, then inspect how the trace explorer and trend panels respond.',
  };
}

export function buildNarrativeEvents(
  metrics: MetricsSnapshot,
  nodes: NodeState[],
  history: TimelinePoint[],
  scenarioId: ScenarioId,
  lead: SimRequest | null,
) {
  const ranked = rankNodes(nodes);
  const top = ranked[0];
  const last = history.length ? history[history.length - 1] : undefined;
  const prev = history.length > 5 ? history[history.length - 6] : last;
  const p95Delta = last && prev ? last.p95Latency - prev.p95Latency : 0;
  const errorDelta = last && prev ? last.errorRate - prev.errorRate : 0;

  const base = [
    {
      title: `Scenario: ${scenarioId}`,
      body: `The simulator is currently running the ${scenarioId} workload profile. Requests are flowing through edge, auth, routing, service, queue, and database tiers with live movement on the topology graph.`,
    },
    {
      title: `${top.label} is the current hotspot`,
      body: `${top.label} is carrying ${Math.round(top.load)}% load with tail latency at ${Math.round(top.p95Latency)} ms, making it the best first stop for root-cause investigation.`,
    },
  ];

  if (p95Delta > 35) {
    base.push({
      title: 'Tail latency is rising',
      body: `p95 latency increased by roughly ${Math.round(p95Delta)} ms over the recent window. That usually means one service tier is saturating or a queue is starting to back up.`,
    });
  }

  if (errorDelta > 1.1) {
    base.push({
      title: 'Failure pressure is building',
      body: `Error rate climbed by ${errorDelta.toFixed(1)} points in the recent window. Retries and downstream contention are likely amplifying the issue.`,
    });
  }

  if (lead) {
    base.push({
      title: `Lead trace now at ${lead.currentNodeId}`,
      body: `The selected request has accumulated ${Math.round(lead.latencyMs)} ms so far with ${lead.retries} retries. That request story is a useful sanity check against the system-level charts.`,
    });
  }

  if (metrics.successRate > 98 && metrics.errorRate < 1.5) {
    base.push({
      title: 'Healthy baseline available',
      body: 'Current success rate is strong, which makes this a good reference point to compare before and after a stress event.',
    });
  }

  return base.slice(0, 4);
}
