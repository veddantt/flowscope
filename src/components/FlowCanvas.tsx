"use client";

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';

import type { NodeState, SimRequest } from '@/types/simulation';
import { useSimulationStore } from '@/store/simulationStore';
import { useViewport } from '@/lib/useViewport';
import { layout } from '@/lib/layout';
import { MobilePathView } from './MobilePathView';

import { CARD_W, CARD_H, HERO_W, HERO_H, CANVAS_W, CANVAS_H, positions, layers, GRAPH_EDGES, NODE_ACCENT, HOVER_HINTS } from './canvas/constants';
import { normalizeNodeId, getNodeSize, isActive, getCurvePath, pct, ms, getSeverity, edgeKey, getActiveEdges, buildReplaySeq, buildInsight, getTimeline, traceLatency, traceStatus } from './canvas/utils';
import { FlowParticle } from './canvas/FlowParticle';
import { CanvasEdges } from './canvas/CanvasEdges';
import { NodeCard } from './canvas/NodeCard';
import { NodeSpotlight } from './canvas/NodeComponents';
import { CinematicOverlay, LetterboxBars, CinematicHUD, CinematicNodeBanner } from './canvas/CinematicElements';
import { FloatingSimControls } from './canvas/SimControls';

type Mode = 'normal' | 'focus' | 'replay' | 'cinematic';

type Props = {
  nodes: NodeState[];
  traces: SimRequest[];
};
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

                <CanvasEdges
                  traces={traces}
                  activeEdges={activeEdges}
                  isCinematic={isCinematic}
                  isAnimating={isAnimating}
                  isFocusActive={isFocusActive}
                  effectiveId={effectiveId}
                />

                {Object.entries(positions).map(([id, pos]) => {
                  const n = nodeMap[id];
                  const active = mode === 'normal'
                    ? isActive(id, traces)
                    : effectiveId === id || isActive(id, traces);
                  const hovered = hoveredNodeId === id;
                  const focused = isFocused(id);
                  const isLead = id === effectiveId;

                  return (
                    <NodeCard
                      key={id}
                      id={id}
                      pos={pos}
                      nodeState={n}
                      active={active}
                      hovered={hovered}
                      focused={focused}
                      isCinematic={isCinematic}
                      isAnimating={isAnimating}
                      isLead={isLead}
                      setHoveredNodeId={setHoveredNodeId}
                    />
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