'use client';

import { motion } from 'framer-motion';

const metrics = [
  { label: 'Throughput', value: '2.4K', suffix: 'req/s' },
  { label: 'Success Rate', value: '98.7', suffix: '%' },
  { label: 'Latency (p95)', value: '142', suffix: 'ms' },
  { label: 'Error Rate', value: '0.3', suffix: '%' },
];

export function HeroMetrics() {
  return (
    <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
      {metrics.map((m, i) => (
        <motion.div
          key={m.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            delay: i * 0.08,
            duration: 0.5,
            ease: 'easeOut',
          }}
          className="group relative"
        >
          {/* glow */}
          <div className="absolute inset-0 rounded-2xl bg-cyan-500/10 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          {/* card */}
          <div className="relative flex items-baseline gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 backdrop-blur-md transition-all duration-300 group-hover:border-cyan-400/40">
            <span className="text-lg font-semibold text-white">
              {m.value}
            </span>
            <span className="text-xs text-cyan-300">{m.suffix}</span>
            <span className="ml-2 text-xs text-white/50">
              {m.label}
            </span>
          </div>
        </motion.div>
      ))}
    </div>
  );
}