"use client";

import { motion, AnimatePresence } from 'framer-motion';
import { positions } from './constants';
import { getNodeSize } from './utils';

export function LatencyRing({ latency, color }: { latency: number; color: string }) {
  const r = 18;
  const circ = 2 * Math.PI * r;
  const fill = Math.min(1, latency / 500) * circ;

  return (
    <div className="relative flex h-11 w-11 flex-shrink-0 items-center justify-center">
      <svg width="44" height="44" className="absolute inset-0" style={{ overflow: 'visible' }}>
        <circle cx="22" cy="22" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2.5" />
        <motion.circle
          cx="22" cy="22" r={r} fill="none" stroke={color} strokeWidth="2.5"
          strokeLinecap="round" strokeDasharray={`${circ}`}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - fill }}
          transition={{ duration: 1.0, ease: 'easeOut' }}
          style={{ transformOrigin: '22px 22px', rotate: '-90deg' }}
        />
      </svg>
      <div className="relative z-10 text-center">
        <div className="text-[9px] font-bold leading-none" style={{ color }}>{Math.round(latency)}</div>
        <div className="mt-[2px] text-[7px] leading-none text-white/35">ms</div>
      </div>
    </div>
  );
}

export function LoadBar({ load, color }: { load: number; color: string }) {
  const segs = 8;
  const filled = Math.round((load / 100) * segs);

  return (
    <div className="flex gap-[3px]">
      {Array.from({ length: segs }).map((_, i) => (
        <motion.div
          key={i}
          className="h-[3.5px] flex-1 rounded-full"
          animate={{ opacity: i < filled ? 0.85 : 0.10 }}
          transition={{ duration: 0.4, delay: i * 0.035 }}
          style={{ backgroundColor: i < filled ? color : 'rgba(255,255,255,0.12)' }}
        />
      ))}
    </div>
  );
}

export function PulseDot({ color, active, isAnimating }: { color: string; active: boolean; isAnimating: boolean }) {
  return (
    <div className="relative flex h-3 w-3 flex-shrink-0 items-center justify-center">
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{ backgroundColor: color }}
        animate={
          active
            ? { scale: [1, 2.5, 1], opacity: [0.7, 0, 0.7] }
            : !isAnimating
              ? { scale: [1, 1.2, 1], opacity: [0.4, 0.2, 0.4] }
              : { scale: 1, opacity: 0 }
        }
        transition={{
          duration: active ? 1.6 : 3.5,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      <div
        className="h-2.5 w-2.5 rounded-full"
        style={{
          backgroundColor: color,
          boxShadow: active ? `0 0 5px ${color}, 0 0 12px ${color}55` : `0 0 4px ${color}33`,
        }}
      />
    </div>
  );
}

export function NodeSpotlight({ nodeId, color, active }: { nodeId: string; color: string; active: boolean }) {
  const pos = positions[nodeId];
  const { w, h } = getNodeSize(nodeId);
  if (!pos) return null;
  const cx = pos.x + w / 2;
  const cy = pos.y + h / 2;

  return (
    <AnimatePresence>
      {active && (
        <motion.ellipse
          cx={cx} cy={cy} rx={w * 0.85} ry={h * 0.75}
          fill="none"
          stroke={color}
          strokeWidth="1"
          initial={{ opacity: 0, rx: w * 0.3, ry: h * 0.3 }}
          animate={{ opacity: [0, 0.55, 0.25], rx: w * 0.85, ry: h * 0.75 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
          style={{ filter: `drop-shadow(0 0 12px ${color})` }}
        />
      )}
    </AnimatePresence>
  );
}
