"use client";

import { motion, useSpring, useMotionValue, useTransform } from 'framer-motion';
import { useRef, useState } from 'react';

/**
 * A "magnetic" button wrapper that pulls toward the cursor when nearby.
 * Adds a premium, tactile feel to primary call-to-actions.
 */
export function MagneticButton({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Smooth out the movement with springs
  const springConfig = { damping: 15, stiffness: 150, mass: 0.1 };
  const springX = useSpring(x, springConfig);
  const springY = useSpring(y, springConfig);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const { clientX, clientY } = e;
    const { left, top, width, height } = ref.current.getBoundingClientRect();
    
    // Calculate distance from center
    const centerX = left + width / 2;
    const centerY = top + height / 2;
    
    // The "pull" strength (0.35 = 35% of the distance)
    const strength = 0.35;
    x.set((clientX - centerX) * strength);
    y.set((clientY - centerY) * strength);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      style={{ x: springX, y: springY }}
      className="relative"
    >
      {children}
      
      {/* Subtle outer glow that follows the pull */}
      {isHovered && (
        <motion.div
          layoutId="button-glow"
          className="absolute inset-0 z-[-1] rounded-full bg-cyan-400/20 blur-xl"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1.2 }}
          exit={{ opacity: 0, scale: 0.8 }}
        />
      )}
    </motion.div>
  );
}
