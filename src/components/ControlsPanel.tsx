import {
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  TimerReset,
  Zap,
  Sparkles,
} from 'lucide-react';
import { SCENARIOS } from '../data/scenarios';
import { useSimulationStore } from '../store/simulationStore';
import { useViewport } from '../lib/useViewport';
import { layout } from '../lib/layout';
import { MagneticButton } from './MagneticButton';

export function ControlsPanel() {
  const {
    isRunning,
    speed,
    scenarioId,
    autoFollow,
    start,
    stop,
    reset,
    step,
    setScenario,
    setSpeed,
    setAutoFollow,
  } = useSimulationStore();

  const { tier, isMobile } = useViewport();
  const px = layout.sectionPadding[tier];

  return (
    <section className="panel" style={{ padding: `${px}px` }}>
      <div className="noise-overlay" />
      <div className="relative z-10 space-y-5">

        {/* HEADER */}
        <div>
          <div className="eyebrow flex items-center gap-2">
            <Sparkles size={14} />
            incident director
          </div>
          <h2 className={`mt-2 font-semibold text-white ${isMobile ? 'text-lg' : 'text-2xl'}`}>
            {isMobile
              ? 'Direct the flow.'
              : 'Orchestrate system behavior. Observe failures. Direct the flow.'}
          </h2>
        </div>

        {/* DIRECTIVE CONTROLS */}
        <div className={`flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] ${
          isMobile ? 'px-3 py-2.5 justify-center' : 'px-4 py-3 justify-between'
        }`}>

          {/* ACTIONS */}
          <div className="flex items-center gap-2">
            <MagneticButton>
              <button
                onClick={isRunning ? stop : start}
                className={`flex items-center gap-2 rounded-xl bg-cyan-400/90 font-medium text-black transition hover:bg-cyan-300 ${
                  isMobile ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'
                }`}
              >
                {isRunning ? <Pause size={isMobile ? 14 : 16} /> : <Play size={isMobile ? 14 : 16} />}
                {isMobile
                  ? (isRunning ? 'Pause' : 'Run')
                  : (isRunning ? 'Freeze Moment' : 'Run System')}
              </button>
            </MagneticButton>

            <button
              onClick={step}
              className={`flex items-center gap-2 rounded-xl border border-white/10 text-white/80 hover:bg-white/10 ${
                isMobile ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'
              }`}
            >
              <SkipForward size={isMobile ? 14 : 16} />
              {!isMobile && 'Advance'}
            </button>

            <button
              onClick={reset}
              className={`flex items-center gap-2 rounded-xl border border-white/10 text-white/80 hover:bg-white/10 ${
                isMobile ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'
              }`}
            >
              <RotateCcw size={isMobile ? 14 : 16} />
              {!isMobile && 'Rewind'}
            </button>

            {!isMobile && (
              <button
                onClick={() => setAutoFollow(!autoFollow)}
                className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition ${
                  autoFollow
                    ? 'bg-cyan-400/20 text-cyan-200 border border-cyan-300/30'
                    : 'border border-white/10 text-white/70 hover:bg-white/10'
                }`}
              >
                <TimerReset size={16} />
                Auto
              </button>
            )}
          </div>

          {/* SPEED CONTROL */}
          <div className="flex items-center gap-3">
            {!isMobile && <div className="text-sm text-white/60">Playback</div>}

            <input
              className={`range-premium ${isMobile ? 'w-[90px]' : 'w-[140px]'}`}
              type="range"
              min={1}
              max={5}
              step={1}
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
            />

            <div className={`font-medium text-white ${isMobile ? 'text-xs' : 'text-sm'}`}>{speed}x</div>

            {!isMobile && (
              <div className="hidden items-center gap-1 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2 py-1 text-xs text-cyan-200 sm:flex">
                <Zap size={12} />
                live
              </div>
            )}
          </div>
        </div>

        {/* SCENE SELECTOR */}
        <div className={`flex gap-3 overflow-x-auto pb-1 ${isMobile ? '-mx-2 px-2' : ''}`}>
          {SCENARIOS.map((scenario) => {
            const active = scenario.id === scenarioId;

            return (
              <button
                key={scenario.id}
                onClick={() => setScenario(scenario.id)}
                className={`flex-shrink-0 rounded-2xl border px-4 py-3 text-left transition ${
                  isMobile ? 'min-w-[150px]' : 'min-w-[200px]'
                } ${
                  active
                    ? 'border-cyan-300/40 bg-cyan-400/10 shadow-[0_10px_30px_rgba(14,116,144,0.2)]'
                    : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`font-semibold text-white ${isMobile ? 'text-xs' : 'text-sm'}`}>
                    🎬 {scenario.label}
                  </span>
                  <span
                    className={`h-2 w-2 rounded-full ${
                      active ? 'bg-cyan-300' : 'bg-white/20'
                    }`}
                  />
                </div>

                {!isMobile && (
                  <div className="mt-1 text-xs text-white/40 line-clamp-2">
                    {scenario.description}
                  </div>
                )}
              </button>
            );
          })}
        </div>

      </div>
    </section>
  );
}