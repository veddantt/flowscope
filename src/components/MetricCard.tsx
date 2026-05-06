import { motion } from 'framer-motion';

export function MetricCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <motion.div
      layout
      className="glass rounded-3xl p-5 shadow-glow"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="text-xs uppercase tracking-[0.22em] text-slate-400">{label}</div>
      <div className="mt-3 text-3xl font-semibold text-white">{value}</div>
      <div className="mt-2 text-sm text-slate-400">{hint}</div>
    </motion.div>
  );
}
