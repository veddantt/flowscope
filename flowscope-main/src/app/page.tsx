"use client";

import { Activity, Sparkles } from 'lucide-react';
import { useMemo, useRef } from 'react';

import { ControlsPanel } from '@/components/ControlsPanel';
import { FlowCanvas } from '@/components/FlowCanvas';
import { InsightsPanel } from '@/components/InsightsPanel';
import { TracesPanel } from '@/components/TracesPanel';

import { formatCompact, formatMs, formatPct } from '@/lib/format';
import { useSimulationStore } from '@/store/simulationStore';
import { useViewport } from '@/lib/useViewport';
import { useScrollCompress } from '@/lib/useScrollCompress';
import { layout } from '@/lib/layout';

function getSystemHealth(errorRate: number, p95: number) {
  if (errorRate > 5 || p95 > 320) {
    return { label: 'Critical', tone: 'text-rose-300', dot: 'bg-rose-400', border: 'border-rose-400/30 bg-rose-500/10' };
  }
  if (errorRate > 2 || p95 > 220) {
    return { label: 'Degraded', tone: 'text-amber-200', dot: 'bg-amber-300', border: 'border-amber-300/30 bg-amber-400/10' };
  }
  return { label: 'Stable', tone: 'text-cyan-200', dot: 'bg-cyan-300', border: 'border-cyan-300/30 bg-cyan-400/10' };
}

export default function App() {
  const { metrics, nodes, requestsById, scenarioId } = useSimulationStore();
  const { tier, isMobile, isTablet } = useViewport();
  const scroll = useScrollCompress(isMobile ? 200 : 300);

  const visibleTraces = useMemo(
    () => Object.values(requestsById).slice(0, 12),
    [requestsById]
  );

  const health = getSystemHealth(metrics.errorRate, metrics.p95Latency);

  const sectionPx = layout.sectionPadding[tier];
  const showHeroPreview = tier === 'expanded';

  return (
    <main className="relative min-h-screen min-h-[100dvh] overflow-hidden text-slate-100"
      style={{
        paddingLeft: sectionPx,
        paddingRight: sectionPx,
        paddingTop: isMobile ? 16 : 24,
        paddingBottom: isMobile ? 16 : 24,
      }}
    >
      {/* ambient glow */}
      <div className="ambient-orb ambient-orb-left" />
      <div className="ambient-orb ambient-orb-right" />

      <div className="mx-auto w-full max-w-[1400px] flex flex-col relative">

        {/* ================= HERO — scroll-compressible ================= */}
        <div 
          className="sticky z-0" 
          style={{ top: isMobile ? 16 : 24 }}
        >
          <section
            className="panel panel-hero relative overflow-hidden hero-compressible"
          style={{
            padding: isMobile ? '24px 20px' : '40px 32px',
            transform: `scale(${scroll.heroScale < 0.5 ? 0.5 : scroll.heroScale})`,
            opacity: scroll.heroOpacity < 0.05 ? 0 : scroll.heroOpacity,
            transformOrigin: 'top center',
            willChange: 'transform, opacity',
          }}
        >
          <div className="hero-grid absolute inset-0 opacity-50" />

          <div className={`relative ${showHeroPreview ? 'grid items-center gap-10 xl:grid-cols-[1.1fr_0.9fr]' : ''}`}>

            {/* LEFT SIDE */}
            <div>

              {/* Badge */}
              <div className={`inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/10 text-cyan-100 uppercase ${
                isMobile ? 'px-2.5 py-0.5 text-[9px] tracking-[0.20em]' : 'px-3 py-1 text-[11px] tracking-[0.25em]'
              }`}>
                <Sparkles size={isMobile ? 12 : 14} />
                {isMobile ? 'Real-time Sim' : 'Distributed Systems • Real-time Simulation'}
              </div>

              {/* Status */}
              <div className={`flex flex-wrap items-center gap-2 ${isMobile ? 'mt-3 text-xs' : 'mt-5 gap-3 text-sm'}`}>
                <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 ${health.border}`}>
                  <span className={`h-2.5 w-2.5 rounded-full ${health.dot}`} />
                  <span className="text-white/70">System</span>
                  <span className={`font-semibold ${health.tone}`}>{health.label}</span>
                </div>

                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-white/70">
                  <Activity size={14} />
                  {!isMobile && 'Scenario'}
                  <span className="font-medium text-white">{scenarioId}</span>
                </div>
              </div>

              {/* Headline */}
              <h1 className={`font-semibold tracking-tight text-white leading-[1.05] ${
                isMobile ? 'mt-4 text-3xl' : 'mt-6 max-w-3xl text-5xl md:text-7xl'
              }`}>
                {isMobile ? 'Systems you can see.' : 'I build systems you can see.'}
              </h1>

              {/* Subtext */}
              {!isMobile && (
                <p className="mt-5 max-w-xl text-lg text-slate-300 leading-relaxed">
                  Real-time simulation of distributed systems — latency, failures, retries — visualized as they happen.
                </p>
              )}

              {/* LIVE FEED */}
              <div className={`font-mono text-slate-400 ${isMobile ? 'mt-4 space-y-1.5 text-xs' : 'mt-6 space-y-2 text-sm'}`}>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  Requests: {formatCompact(metrics.throughput)}/s
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                  Error: {formatPct(metrics.errorRate)}
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
                  p95: {formatMs(metrics.p95Latency)}
                </div>
              </div>

              {/* CTA */}
              <div className={`flex flex-wrap items-center gap-3 ${isMobile ? 'mt-5' : 'mt-7'}`}>
                <button
                  onClick={() => {
                    document.getElementById('simulator')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className={`rounded-full bg-cyan-500 font-medium text-black transition hover:bg-cyan-400 ${
                    isMobile ? 'px-4 py-2 text-sm' : 'px-5 py-2.5'
                  }`}
                >
                  Open Simulator →
                </button>

                {!isMobile && (
                  <button
                    onClick={() => {
                      document.getElementById('traces')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="rounded-full border border-white/10 px-5 py-2.5 text-white/70 transition hover:bg-white/5"
                  >
                    View Traces
                  </button>
                )}
              </div>
            </div>

            {/* RIGHT SIDE → LIVE SYSTEM (desktop only) */}
            {showHeroPreview && (
              <div className="relative h-[360px] xl:h-[420px] rounded-3xl border border-white/10 bg-white/[0.02] overflow-hidden">
                <FlowCanvas nodes={nodes} traces={visibleTraces} />
              </div>
            )}
          </div>
          </section>
        </div>

        {/* ================= CONTENT BELOW HERO ================= */}
        <div className="relative z-10 mt-6 space-y-6">
          {/* ================= STATUS BAR ================= */}
          <section className="panel" style={{ padding: `${isMobile ? 12 : 20}px ${isMobile ? 16 : 20}px` }}>
          <div className={`flex flex-wrap items-center text-white/70 ${
            isMobile ? 'gap-2 text-xs' : 'gap-4 text-sm'
          }`}>
            <span className="status-chip">
              Throughput <strong className="ml-1 text-white">{formatCompact(metrics.throughput)}/s</strong>
            </span>
            <span className="status-chip">
              Error <strong className="ml-1 text-white">{formatPct(metrics.errorRate)}</strong>
            </span>
            {!isMobile && (
              <span className="status-chip">
                Latency <strong className="ml-1 text-white">{formatMs(metrics.avgLatency)}</strong>
              </span>
            )}
            <span className="status-chip">
              p95 <strong className="ml-1 text-white">{formatMs(metrics.p95Latency)}</strong>
            </span>
          </div>
        </section>

        {/* ================= CONTROLS ================= */}
        <ControlsPanel />

        {/* ================= MAIN SIMULATOR ================= */}
        <section id="simulator" className={`space-y-6 ${isMobile ? 'space-y-4' : 'space-y-8'}`}>

          <FlowCanvas nodes={nodes} traces={visibleTraces} />

          <div className={`grid gap-6 ${
            isMobile ? 'grid-cols-1 gap-4' : 'grid-cols-1 lg:grid-cols-[1fr_320px]'
          }`}>
            <div id="traces">
              <TracesPanel />
            </div>

            <div>
              <InsightsPanel />
            </div>
          </div>

        </section>
        </div>

      </div>
    </main>
  );
}