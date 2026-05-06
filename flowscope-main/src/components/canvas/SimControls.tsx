"use client";

import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { Play, Pause, SkipForward, RotateCcw } from 'lucide-react';
import { useSimulationStore } from '@/store/simulationStore';

export function FloatingSimControls() {
  const { isRunning, speed, start, stop, step, reset, setSpeed } = useSimulationStore();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <motion.div
      className="absolute bottom-4 left-1/2 z-40 -translate-x-1/2"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut', delay: 0.15 }}
    >
      <AnimatePresence mode="wait">
        {collapsed ? (
          <motion.button
            key="collapsed"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.18 }}
            onClick={() => setCollapsed(false)}
            className="flex items-center gap-2 rounded-2xl px-4 py-2.5 text-[11px] font-medium transition-all duration-200"
            style={{
              background: 'rgba(4,10,22,0.92)',
              border: `1px solid ${isRunning ? 'rgba(56,189,248,0.25)' : 'rgba(255,255,255,0.10)'}`,
              boxShadow: `0 4px 30px rgba(0,0,0,0.60), 0 0 0 1px rgba(255,255,255,0.04)${isRunning ? ', 0 0 20px rgba(56,189,248,0.12)' : ''}`,
              backdropFilter: 'blur(24px)',
              color: isRunning ? '#7dd3fc' : 'rgba(255,255,255,0.50)',
            }}
          >
            {isRunning ? <Pause size={13} /> : <Play size={13} />}
            {isRunning ? 'Running' : 'Paused'}
            <span className="text-[9px] text-white/25">▲</span>
          </motion.button>
        ) : (
          <motion.div
            key="expanded"
            initial={{ opacity: 0, scale: 0.92, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 8 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-1.5 rounded-2xl px-2.5 py-2"
            style={{
              background: 'rgba(4,10,22,0.92)',
              border: `1px solid ${isRunning ? 'rgba(56,189,248,0.20)' : 'rgba(255,255,255,0.10)'}`,
              boxShadow: `0 4px 30px rgba(0,0,0,0.60), 0 0 0 1px rgba(255,255,255,0.04)${isRunning ? ', 0 0 24px rgba(56,189,248,0.10)' : ''}`,
              backdropFilter: 'blur(24px)',
            }}
          >
            {/* Play / Pause */}
            <button
              onClick={isRunning ? stop : start}
              className="flex items-center gap-1.5 rounded-[12px] px-3.5 py-1.5 text-[11px] font-semibold transition-all duration-200"
              style={{
                background: isRunning ? 'rgba(56,189,248,0.15)' : 'rgba(56,189,248,0.90)',
                color: isRunning ? '#7dd3fc' : '#000',
                border: isRunning ? '1px solid rgba(56,189,248,0.30)' : '1px solid rgba(56,189,248,0.60)',
                boxShadow: isRunning ? 'none' : '0 0 16px rgba(56,189,248,0.30)',
              }}
            >
              {isRunning ? <Pause size={13} /> : <Play size={13} />}
              {isRunning ? 'Pause' : 'Start'}
            </button>

            <div className="mx-0.5 h-5 w-px bg-white/8" />

            {/* Step */}
            <button
              onClick={step}
              title="Advance one step"
              className="flex items-center gap-1 rounded-[12px] px-2.5 py-1.5 text-[11px] text-white/50 transition-all duration-150 hover:bg-white/[0.06] hover:text-white/80"
              style={{ border: '1px solid transparent' }}
            >
              <SkipForward size={13} />
              <span className="hidden sm:inline">Step</span>
            </button>

            {/* Reset */}
            <button
              onClick={reset}
              title="Reset simulation"
              className="flex items-center gap-1 rounded-[12px] px-2.5 py-1.5 text-[11px] text-white/50 transition-all duration-150 hover:bg-white/[0.06] hover:text-white/80"
              style={{ border: '1px solid transparent' }}
            >
              <RotateCcw size={13} />
              <span className="hidden sm:inline">Reset</span>
            </button>

            <div className="mx-0.5 h-5 w-px bg-white/8" />

            {/* Speed */}
            <div className="flex items-center gap-1.5 px-1">
              <span className="text-[9px] font-medium uppercase tracking-wider text-white/30">spd</span>
              <input
                className="range-premium w-[70px]"
                type="range"
                min={1}
                max={5}
                step={1}
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
              />
              <span className="w-5 text-center font-mono text-[10px] text-white/40">{speed}×</span>
            </div>

            <div className="mx-0.5 h-5 w-px bg-white/8" />

            {/* Collapse */}
            <button
              onClick={() => setCollapsed(true)}
              title="Minimize controls"
              className="flex h-6 w-6 items-center justify-center rounded-lg text-[10px] text-white/30 transition hover:bg-white/[0.06] hover:text-white/60"
            >
              ▼
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
