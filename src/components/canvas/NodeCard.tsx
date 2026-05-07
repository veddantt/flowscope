"use client";

import { motion } from 'framer-motion';
import type { NodeState } from '@/types/simulation';
import { NODE_ACCENT } from './constants';
import { getNodeSize, getSeverity, pct } from './utils';
import { PulseDot, LoadBar, LatencyRing } from './NodeComponents';

type NodeCardProps = {
  id: string;
  pos: { x: number; y: number };
  nodeState?: NodeState;
  active: boolean;
  hovered: boolean;
  focused: boolean;
  isCinematic: boolean;
  isAnimating: boolean;
  isLead: boolean;
  setHoveredNodeId: (id: string | null) => void;
};

export function NodeCard({
  id,
  pos,
  nodeState: n,
  active,
  hovered,
  focused,
  isCinematic,
  isAnimating,
  isLead,
  setHoveredNodeId,
}: NodeCardProps) {
  const acc = NODE_ACCENT[id] ?? { hex: '#38bdf8', rgb: '56,189,248', label: id.toUpperCase(), role: '' };
  const isHero = id === 'service';
  const { w, h } = getNodeSize(id);
  const sev = getSeverity(n?.load ?? 0, n?.p95Latency ?? 0);
  const isCrit = sev === 'critical';
  const load = n?.load ?? 0;
  const lat = n?.p95Latency ?? 0;

  const focusOpacity = isCinematic
    ? isLead
      ? 1
      : 0.02
    : focused
      ? 1
      : 0.06;

  const borderCol = active
    ? `rgba(${acc.rgb},0.50)`
    : isCrit ? 'rgba(251,113,133,0.28)'
      : hovered ? `rgba(${acc.rgb},0.28)`
        : 'rgba(255,255,255,0.07)';

  const shadowVal = active
    ? `0 0 0 1px rgba(${acc.rgb},0.22), 0 0 30px rgba(${acc.rgb},0.25), 0 0 70px rgba(${acc.rgb},0.10), 0 24px 60px rgba(0,0,0,0.50)`
    : isCrit
      ? '0 0 0 1px rgba(251,113,133,0.16), 0 0 26px rgba(251,113,133,0.18), 0 0 55px rgba(239,68,68,0.45), 0 20px 50px rgba(0,0,0,0.45)'
      : hovered
        ? `0 0 0 1px rgba(${acc.rgb},0.20), 0 0 30px rgba(${acc.rgb},0.16), 0 20px 55px rgba(0,0,0,0.50)`
        : '0 0 0 1px rgba(255,255,255,0.04), 0 12px 40px rgba(0,0,0,0.38)';

  const activeShadow = isCinematic && active && isCrit
    ? `0 0 0 2px rgba(${acc.rgb},0.45), 0 0 60px rgba(${acc.rgb},0.55), 0 0 120px rgba(251,113,133,0.30), 0 30px 80px rgba(0,0,0,0.70)`
    : isCinematic && active
      ? `0 0 0 2px rgba(${acc.rgb},0.40), 0 0 50px rgba(${acc.rgb},0.45), 0 0 100px rgba(${acc.rgb},0.20), 0 28px 70px rgba(0,0,0,0.65)`
      : shadowVal;

  return (
    <motion.div
      key={id}
      className="absolute select-none"
      style={{
        left: pos.x,
        top: pos.y,
        width: w,
        height: h,
        opacity: focusOpacity,
        filter: isCinematic
          ? isLead
            ? 'none'
            : 'blur(4px)'
          : focused
            ? 'none'
            : 'blur(2px)',
        transition: 'opacity 0.55s ease, filter 0.55s ease',
        zIndex: hovered ? 10 : active ? 5 : 1,
      }}
      animate={{
        y: active ? [0, -4, 0] : 0,
        scale: active && isCinematic
          ? [1, 1.08, 1.03]
          : hovered ? (isHero ? 1.042 : 1.035) : 1,
      }}
      transition={{
        y: { duration: isCinematic ? 4.5 : 3.0, repeat: Infinity, ease: 'easeInOut' },
        scale: {
          duration: isCinematic ? 2.2 : 0.28,
          ease: isCinematic ? 'easeInOut' : [0.34, 1.56, 0.64, 1],
          repeat: isCinematic && active ? Infinity : 0,
        },
      }}
      onMouseEnter={() => setHoveredNodeId(id)}
      onMouseLeave={() => setHoveredNodeId(null)}
    >
      <div
        className="relative h-full w-full overflow-hidden rounded-[20px]"
        style={{
          background: isHero
            ? `linear-gradient(140deg, rgba(${acc.rgb},0.11) 0%, rgba(8,16,34,0.96) 45%, rgba(4,10,22,0.97) 100%)`
            : 'linear-gradient(155deg, rgba(255,255,255,0.038) 0%, rgba(6,12,28,0.95) 55%, rgba(3,8,18,0.97) 100%)',
          border: `1px solid ${borderCol}`,
          boxShadow: activeShadow,
          backdropFilter: 'blur(22px)',
          transition: 'border-color 0.32s ease, box-shadow 0.55s ease',
        }}
      >
        <div
          className="absolute bottom-[10%] left-0 top-[10%] w-[3px] rounded-r-full"
          style={{
            background: `linear-gradient(180deg, ${acc.hex}bb 0%, ${acc.hex}33 100%)`,
            opacity: active ? 1 : isCrit ? 0.85 : hovered ? 0.7 : 0.38,
            transition: 'opacity 0.3s ease',
          }}
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-10 rounded-t-[20px]"
          style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, transparent 100%)' }}
        />
        
        {/* Physical texture overlay */}
        <div className="noise-overlay" />

        {active && (
          <motion.div
            className="pointer-events-none absolute inset-0 rounded-[20px]"
            animate={{ opacity: isCinematic ? [0.10, 0.40, 0.10] : [0.10, 0.26, 0.10] }}
            transition={{ duration: isCinematic ? 3.5 : 2.2, repeat: Infinity, ease: 'easeInOut' }}
            style={{ background: `radial-gradient(ellipse at 50% 0%, rgba(${acc.rgb},0.18) 0%, transparent 60%)` }}
          />
        )}

        {!isAnimating && (
          <motion.div
            className="pointer-events-none absolute inset-0 rounded-[20px]"
            animate={{ opacity: [0.04, 0.08, 0.04] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              background: `radial-gradient(circle at 50% 0%, rgba(${acc.rgb},0.12), transparent 60%)`,
            }}
          />
        )}

        {isCrit && (
          <motion.div
            className="pointer-events-none absolute inset-0 rounded-[20px]"
            animate={{ opacity: [0, isCinematic ? 0.35 : 0.20, 0] }}
            transition={{ duration: isCinematic ? 1.8 : 1.3, repeat: Infinity, ease: 'easeInOut' }}
            style={{ background: 'radial-gradient(ellipse at 50% 50%, rgba(239,68,68,0.22) 0%, transparent 65%)' }}
          />
        )}

        {isCrit && isCinematic && (
          <motion.div
            className="absolute inset-0 rounded-[20px]"
            animate={{
              scale: [1, 1.08, 1],
              opacity: [0.2, 0.5, 0.2],
            }}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            style={{
              border: '1px solid rgba(239,68,68,0.4)',
              boxShadow: '0 0 40px rgba(239,68,68,0.6)',
            }}
          />
        )}

        <div className="relative flex h-full flex-col px-[18px] py-3.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="mb-0.5 flex items-center gap-2">
                <PulseDot color={acc.hex} active={active} isAnimating={isAnimating} />
                <div className="truncate text-[13px] font-semibold leading-snug text-white">
                  {n?.label ?? acc.label}
                </div>
                {isHero && (
                  <div
                    className="flex-shrink-0 rounded-full px-1.5 py-[2px] text-[8px] font-semibold uppercase tracking-wider"
                    style={{ background: `rgba(${acc.rgb},0.14)`, color: acc.hex, border: `1px solid rgba(${acc.rgb},0.22)` }}
                  >
                    core
                  </div>
                )}
              </div>
              <div className="pl-[18px] text-[10px] leading-none text-white/35">{acc.role}</div>
            </div>
            <div
              className="flex-shrink-0 rounded-full px-2 py-[3px] text-[8.5px] font-bold uppercase tracking-wider"
              style={{
                background: isCrit ? 'rgba(239,68,68,0.14)' : sev === 'elevated' ? 'rgba(245,158,11,0.12)' : `rgba(${acc.rgb},0.10)`,
                color: isCrit ? '#fca5a5' : sev === 'elevated' ? '#fcd34d' : acc.hex,
                border: `1px solid ${isCrit ? 'rgba(239,68,68,0.22)' : sev === 'elevated' ? 'rgba(245,158,11,0.18)' : `rgba(${acc.rgb},0.16)`}`,
              }}
            >
              {isCrit ? 'crit' : sev === 'elevated' ? 'high' : 'ok'}
            </div>
          </div>

          <div
            className="my-3 h-px"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.065) 25%, rgba(255,255,255,0.065) 75%, transparent)' }}
          />

          <div className="flex items-end gap-3">
            <div className="min-w-0 flex-1">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[9px] font-medium uppercase tracking-widest text-white/30">Load</span>
                <span className="text-[11px] font-bold text-white/85">{pct(load)}</span>
              </div>
              <LoadBar load={load} color={acc.hex} />
            </div>
            <LatencyRing latency={lat} color={isCrit ? '#fb7185' : acc.hex} />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
