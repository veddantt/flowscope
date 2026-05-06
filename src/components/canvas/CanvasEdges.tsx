"use client";

import { motion } from 'framer-motion';
import type { SimRequest } from '@/types/simulation';
import { CANVAS_W, CANVAS_H, GRAPH_EDGES, NODE_ACCENT } from './constants';
import { getCurvePath, edgeKey, normalizeNodeId } from './utils';
import { FlowParticle } from './FlowParticle';
import { NodeSpotlight } from './NodeComponents';

type CanvasEdgesProps = {
  traces: SimRequest[];
  activeEdges: Set<string>;
  isCinematic: boolean;
  isAnimating: boolean;
  isFocusActive: boolean;
  effectiveId: string;
};

export function CanvasEdges({
  traces,
  activeEdges,
  isCinematic,
  isAnimating,
  isFocusActive,
  effectiveId,
}: CanvasEdgesProps) {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
      preserveAspectRatio="xMinYMin meet"
    >
      <defs>
        {[
          { id: 'arr-c', col: '#38bdf8' },
          { id: 'arr-v', col: '#818cf8' },
          { id: 'arr-r', col: '#fb7185' },
          { id: 'arr-g', col: '#34d399' },
          { id: 'arr-p', col: '#a78bfa' },
          { id: 'arr-pk', col: '#f472b6' },
        ].map(({ id, col }) => (
          <marker key={id} id={id} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="4.5" markerHeight="4.5" orient="auto-start-reverse">
            <path d="M 0 1.5 L 8.5 5 L 0 8.5 z" fill={col} opacity="0.88" />
          </marker>
        ))}
        <linearGradient id="rail" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.08)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.025)" />
        </linearGradient>
        {[
          { id: 'gc', a: '#38bdf8', b: '#818cf8' },
          { id: 'gr', a: '#818cf8', b: '#fb7185' },
          { id: 'gg', a: '#38bdf8', b: '#34d399' },
          { id: 'gv', a: '#818cf8', b: '#a78bfa' },
          { id: 'gp', a: '#38bdf8', b: '#f472b6' },
        ].map(({ id, a, b }) => (
          <linearGradient key={id} id={id} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={a} />
            <stop offset="100%" stopColor={b} />
          </linearGradient>
        ))}
        <filter id="eg">
          <feGaussianBlur stdDeviation="2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="cineGlow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {isCinematic && (
        <NodeSpotlight
          nodeId={effectiveId}
          color={NODE_ACCENT[effectiveId]?.hex ?? '#38bdf8'}
          active
        />
      )}

      {GRAPH_EDGES.map(([from, to]) => {
        const p = getCurvePath(from, to);
        const k = edgeKey(from, to);
        const active = activeEdges.has(k);
        const dimmed = isFocusActive && !active;
        const gradId = to === 'db' ? 'gr' : to === 'cache' ? 'gg' : to === 'queue' ? 'gv' : to === 'auth' ? 'gp' : 'gc';
        const arrId = to === 'db' ? 'arr-r' : to === 'cache' ? 'arr-g' : to === 'queue' ? 'arr-p' : to === 'auth' ? 'arr-pk' : 'arr-c';
        const pColor = NODE_ACCENT[to]?.hex ?? '#38bdf8';

        return (
          <g key={k}>
            <path d={p} fill="none" stroke="url(#rail)" strokeWidth="1.5" strokeLinecap="round" opacity={dimmed ? 0.06 : 0.32} />
            <motion.path
              d={p}
              fill="none"
              stroke={`url(#${gradId})`}
              strokeWidth={active ? (isCinematic ? 3.2 : 2.6) : 1.2}
              strokeLinecap="round"
              strokeDasharray="11 8"
              filter={active ? (isCinematic ? 'url(#cineGlow)' : 'url(#eg)') : undefined}
              markerEnd={active ? `url(#${arrId})` : undefined}
              initial={false}
              animate={{
                strokeDashoffset: isAnimating ? [0, -38] : 0,
                opacity: active ? 1 : dimmed ? 0.04 : 0.12,
              }}
              transition={{
                strokeDashoffset: isAnimating
                  ? {
                    duration: isCinematic
                      ? (active ? 1.4 : 2.8)
                      : (active ? 0.85 : 2.0),
                    repeat: Infinity,
                    ease: 'linear',
                  }
                  : { duration: 0.35 },
                opacity: { duration: 0.3 },
              }}
            />
            {traces.slice(0, 25).map((trace, i) => {
              const pathNodes = (trace.path ?? []).map(normalizeNodeId);

              for (let j = 0; j < pathNodes.length - 1; j++) {
                if (pathNodes[j] === from && pathNodes[j + 1] === to) {
                  const isFailed = (trace as { failed?: boolean }).failed;
                  const isRetry = (trace as { retrying?: boolean }).retrying;

                  return (
                    <FlowParticle
                      key={`${trace.id}-${j}`}
                      path={p}
                      duration={isCinematic ? 2.8 : 2.0}
                      delay={i * 0.08}
                      size={isCinematic ? 5 : 3.5}
                      color={
                        isFailed
                          ? '#fb7185'
                          : isRetry
                            ? '#fbbf24'
                            : pColor
                      }
                      cinematic={isCinematic}
                    />
                  );
                }
              }
              return null;
            })}
          </g>
        );
      })}
    </svg>
  );
}
