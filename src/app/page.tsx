"use client";

import { Activity, Sparkles, Monitor, Maximize2, Minimize2 } from 'lucide-react';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import { useMemo, useRef, useState, useEffect } from 'react';

import { ControlsPanel } from '@/components/ControlsPanel';
import { FlowCanvas } from '@/components/FlowCanvas';
import { InsightsPanel } from '@/components/InsightsPanel';
import { TracesPanel } from '@/components/TracesPanel';
import { MagneticButton } from '@/components/MagneticButton';
import { BackgroundGrid } from '@/components/BackgroundGrid';

import { formatCompact, formatMs, formatPct } from '@/lib/format';
import { useSimulationStore } from '@/store/simulationStore';
import { useViewport } from '@/lib/useViewport';
import { layout } from '@/lib/layout';

function getSystemHealth(errorRate: number, p95: number) {
  if (errorRate > 5 || p95 > 320) {
    return { 
      label: 'Critical', 
      tone: 'text-rose-300', 
      dot: 'bg-rose-400', 
      border: 'border-rose-400/30 bg-rose-500/10',
      statusClass: 'panel-status-critical'
    };
  }
  if (errorRate > 2 || p95 > 220) {
    return { 
      label: 'Degraded', 
      tone: 'text-amber-200', 
      dot: 'bg-amber-300', 
      border: 'border-amber-300/30 bg-amber-400/10',
      statusClass: 'panel-status-warning'
    };
  }
  return { 
    label: 'Stable', 
    tone: 'text-cyan-200', 
    dot: 'bg-cyan-300', 
    border: 'border-cyan-300/30 bg-cyan-400/10',
    statusClass: 'panel-status-stable'
  };
}

export default function App() {
  const { metrics, nodes, requestsById, scenarioId } = useSimulationStore();
  const { tier, isMobile, isTablet } = useViewport();
  const [isCinematic, setIsCinematic] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"]
  });

  const heroScale = useTransform(scrollYProgress, [0, 0.3], [1, 0.85]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.2], [1, 0]);
  const heroTranslateY = useTransform(scrollYProgress, [0, 0.3], [0, -40]);

  const visibleTraces = useMemo(
    () => Object.values(requestsById).slice(0, 12),
    [requestsById]
  );

  const health = getSystemHealth(metrics.errorRate, metrics.p95Latency);

  const sectionPx = layout.sectionPadding[tier];
  const showHeroPreview = tier === 'expanded';

  return (
    <main className="relative min-h-screen min-h-[100dvh] overflow-hidden text-slate-100 bg-[#020617]"
      style={{
        paddingLeft: sectionPx,
        paddingRight: sectionPx,
        paddingTop: isMobile ? 16 : 24,
        paddingBottom: isMobile ? 16 : 24,
      }}
    >
      <BackgroundGrid />
      <div className="scanline-overlay" />
      
      {/* ambient glow */}
      <div className="ambient-orb ambient-orb-left" />
      <div className="ambient-orb ambient-orb-right" />

      <div className="mx-auto w-full max-w-[1400px] flex flex-col relative">
        
        {/* Floating Cinematic Toggle */}
        <div className="absolute right-0 top-0 z-50 flex items-center gap-3">
          <button
            onClick={() => setIsCinematic(!isCinematic)}
            className="flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-1.5 text-xs font-medium text-white/70 backdrop-blur-md transition hover:bg-white/10 hover:text-white"
          >
            {isCinematic ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            {isCinematic ? 'Exit Cinematic' : 'Cinematic Mode'}
          </button>
        </div>

        <div 
          ref={containerRef}
          className={`sticky z-0 transition-all duration-700 ${isCinematic ? 'opacity-0 -translate-y-10 pointer-events-none' : 'opacity-100 translate-y-0'}`} 
          style={{ top: isMobile ? 16 : 24 }}
        >
          <motion.section
            className={`panel panel-hero relative overflow-hidden ${health.statusClass}`}
            style={{
              padding: isMobile ? '24px 20px' : '40px 32px',
              scale: heroScale,
              opacity: heroOpacity,
              y: heroTranslateY,
              transformOrigin: 'top center',
            }}
          >
            <div className="noise-overlay" />
            <div className="hero-grid absolute inset-0 opacity-50" />

            <div className={`relative ${showHeroPreview ? 'grid items-center gap-10 xl:grid-cols-[1.1fr_0.9fr]' : ''}`}>
              <div>
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                  className={`inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/10 text-cyan-100 uppercase ${
                    isMobile ? 'px-2.5 py-0.5 text-[9px] tracking-[0.20em]' : 'px-3 py-1 text-[11px] tracking-[0.25em]'
                  }`}
                >
                  <Sparkles size={isMobile ? 12 : 14} className="text-cyan-400" />
                  {isMobile ? 'Real-time Sim' : 'Distributed Systems • Real-time Simulation'}
                </motion.div>

                <div className={`flex flex-wrap items-center gap-2 ${isMobile ? 'mt-3 text-xs' : 'mt-5 gap-3 text-sm'}`}>
                  <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 ${health.border}`}>
                    <div className="relative flex h-2.5 w-2.5">
                      <span className={`sonar-ring ${health.tone.replace('text-', 'text-opacity-50 ')}`} style={{ color: 'currentColor' }} />
                      <span className={`h-full w-full rounded-full ${health.dot}`} />
                    </div>
                    <span className="text-white/70">System</span>
                    <span className={`font-semibold ${health.tone}`}>{health.label}</span>
                  </div>

                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-white/70">
                    <Activity size={14} />
                    {!isMobile && 'Scenario'}
                    <span className="font-medium text-white">{scenarioId}</span>
                  </div>
                </div>

                <motion.h1 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  className={`font-semibold tracking-tight text-white leading-[1.05] ${
                    isMobile ? 'mt-4 text-3xl' : 'mt-6 max-w-3xl text-5xl md:text-7xl'
                  }`}
                >
                  {isMobile ? 'Systems you can see.' : 'I build systems you can see.'}
                </motion.h1>

                {!isMobile && (
                  <motion.p 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.3 }}
                    className="mt-5 max-w-xl text-lg text-slate-300 leading-relaxed"
                  >
                    Real-time simulation of distributed systems — latency, failures, retries — visualized as they happen.
                  </motion.p>
                )}

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

                <div className={`flex flex-wrap items-center gap-3 ${isMobile ? 'mt-5' : 'mt-7'}`}>
                  <MagneticButton>
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
                  </MagneticButton>

                  {!isMobile && (
                    <MagneticButton>
                      <button
                        onClick={() => {
                          document.getElementById('traces')?.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="rounded-full border border-white/10 px-5 py-2.5 text-white/70 transition hover:bg-white/5"
                      >
                        View Traces
                      </button>
                    </MagneticButton>
                  )}
                </div>
              </div>

              {showHeroPreview && (
                <div className="relative h-[360px] xl:h-[420px] rounded-3xl border border-white/10 bg-white/[0.02] overflow-hidden">
                  <FlowCanvas nodes={nodes} traces={visibleTraces} />
                </div>
              )}
            </div>
          </motion.section>
        </div>

        <div className={`relative z-10 transition-all duration-700 ${isCinematic ? 'mt-[-100px] lg:mt-[-200px]' : 'mt-6'} space-y-6`}>
          <section className={`panel transition-all duration-500 ${health.statusClass} ${isCinematic ? 'opacity-0 scale-95 pointer-events-none absolute' : 'opacity-100 scale-100'}`} 
                   style={{ padding: `${isMobile ? 12 : 20}px ${isMobile ? 16 : 20}px` }}>
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

          <div className={`transition-all duration-700 ${isCinematic ? 'opacity-0 -translate-y-10 pointer-events-none h-0 overflow-hidden' : 'opacity-100 translate-y-0'}`}>
            <ControlsPanel />
          </div>

          <section id="simulator" className={`space-y-6 ${isMobile ? 'space-y-4' : 'space-y-8'} ${isCinematic ? 'h-[90vh]' : ''}`}>
            <div className={`transition-all duration-700 ${isCinematic ? 'h-full' : ''}`}>
              <FlowCanvas nodes={nodes} traces={visibleTraces} isCinematic={isCinematic} />
            </div>

            <div className={`grid gap-6 transition-all duration-700 ${
              isCinematic ? 'opacity-0 translate-y-20 pointer-events-none' : 'grid-cols-1 lg:grid-cols-[1fr_320px]'
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