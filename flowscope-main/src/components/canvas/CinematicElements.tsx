"use client";

import { motion, AnimatePresence } from 'framer-motion';
import type { NodeState } from '@/types/simulation';
import { NODE_ACCENT } from './constants';
import { getSeverity, pct, ms } from './utils';

export function CinematicOverlay({ active }: { active: boolean }) {
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          className="pointer-events-none absolute inset-0 z-20"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
          style={{
            background: [
              'radial-gradient(ellipse 60% 40% at 50% 50%, transparent 30%, rgba(0,0,0,0.55) 100%)',
              'linear-gradient(180deg, rgba(0,0,0,0.30) 0%, transparent 15%, transparent 85%, rgba(0,0,0,0.30) 100%)',
            ].join(', '),
          }}
        />
      )}
    </AnimatePresence>
  );
}

export function LetterboxBars({ active }: { active: boolean }) {
  return (
    <AnimatePresence>
      {active && (
        <>
          <motion.div
            className="pointer-events-none absolute inset-x-0 top-0 z-40 bg-black"
            initial={{ height: 0 }}
            animate={{ height: 28 }}
            exit={{ height: 0 }}
            transition={{ duration: 0.6, ease: [0.32, 0, 0.67, 0] }}
          />
          <motion.div
            className="pointer-events-none absolute inset-x-0 bottom-0 z-40 bg-black"
            initial={{ height: 0 }}
            animate={{ height: 28 }}
            exit={{ height: 0 }}
            transition={{ duration: 0.6, ease: [0.32, 0, 0.67, 0] }}
          />
        </>
      )}
    </AnimatePresence>
  );
}

export function CinematicHUD({ nodeId, nodeMap, active }: { nodeId: string; nodeMap: Record<string, NodeState>; active: boolean }) {
  const acc = NODE_ACCENT[nodeId];
  const n = nodeMap[nodeId];
  if (!acc || !n) return null;
  const sev = getSeverity(n.load ?? 0, n.p95Latency ?? 0);

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          className="pointer-events-none absolute bottom-8 left-1/2 z-30 -translate-x-1/2"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
        >
          <div
            className="flex items-center gap-3 rounded-2xl px-5 py-3"
            style={{
              background: 'rgba(4,10,22,0.92)',
              border: `1px solid rgba(${acc.rgb},0.28)`,
              boxShadow: `0 0 30px rgba(${acc.rgb},0.18), 0 20px 60px rgba(0,0,0,0.70)`,
              backdropFilter: 'blur(24px)',
            }}
          >
            <motion.div
              className="h-2 w-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: acc.hex, boxShadow: `0 0 8px ${acc.hex}` }}
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            />
            <div>
              <div className="text-[11px] font-semibold leading-none text-white">{acc.label}</div>
              <div className="mt-0.5 text-[9.5px] leading-none text-white/40">{acc.role}</div>
            </div>
            <div className="h-7 w-px bg-white/10" />
            <div className="flex gap-3 text-center">
              <div>
                <div className="text-[10px] font-bold" style={{ color: acc.hex }}>{pct(n.load)}</div>
                <div className="text-[8.5px] text-white/35">load</div>
              </div>
              <div>
                <div className="text-[10px] font-bold" style={{ color: sev === 'critical' ? '#fb7185' : acc.hex }}>{ms(n.p95Latency)}</div>
                <div className="text-[8.5px] text-white/35">p95</div>
              </div>
            </div>
            <div
              className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide"
              style={{
                background: sev === 'critical' ? 'rgba(239,68,68,0.15)' : sev === 'elevated' ? 'rgba(245,158,11,0.13)' : `rgba(${acc.rgb},0.12)`,
                color: sev === 'critical' ? '#fca5a5' : sev === 'elevated' ? '#fcd34d' : acc.hex,
                border: `1px solid ${sev === 'critical' ? 'rgba(239,68,68,0.25)' : sev === 'elevated' ? 'rgba(245,158,11,0.22)' : `rgba(${acc.rgb},0.20)`}`,
              }}
            >
              {sev === 'critical' ? '⚠ critical' : sev === 'elevated' ? '↑ elevated' : '● ok'}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function CinematicNodeBanner({ nodeId, visible }: { nodeId: string; visible: boolean }) {
  const acc = NODE_ACCENT[nodeId];
  if (!acc) return null;

  return (
    <AnimatePresence mode="wait">
      {visible && (
        <motion.div
          key={nodeId}
          className="pointer-events-none absolute left-8 top-8 z-30"
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -12 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        >
          <div className="mb-1 text-[9px] uppercase tracking-[0.32em]" style={{ color: `rgba(${acc.rgb},0.55)` }}>
            analyzing
          </div>
          <div
            className="text-[22px] font-bold tracking-tight"
            style={{ color: acc.hex, textShadow: `0 0 30px rgba(${acc.rgb},0.5)` }}
          >
            {acc.label}
          </div>
          <div className="mt-0.5 text-[11px] text-white/35">{acc.role}</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
