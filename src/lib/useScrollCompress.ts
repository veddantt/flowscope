import { useState, useEffect, useRef } from 'react';
import { lerp } from './layout';

export type ScrollCompressInfo = {
  /** 0→1 scroll progress within threshold */
  progress: number;
  /** Hero height multiplier (1 → ~0.2) */
  heroScale: number;
  /** Hero text opacity (1 → 0) */
  heroOpacity: number;
  /** Canvas scale (0.92 → 1) */
  canvasScale: number;
  /** Whether hero is mostly compressed */
  isCompressed: boolean;
};

/**
 * Scroll-driven compression hook for Apple-keynote-style hero→canvas transitions.
 * Uses requestAnimationFrame for silky 60fps scroll tracking.
 */
export function useScrollCompress(threshold = 300): ScrollCompressInfo {
  const [info, setInfo] = useState<ScrollCompressInfo>({
    progress: 0,
    heroScale: 1,
    heroOpacity: 1,
    canvasScale: 0.92,
    isCompressed: false,
  });

  const rafRef = useRef<number>(0);
  const lastY = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      // Skip raf if scroll hasn't meaningfully changed
      if (Math.abs(y - lastY.current) < 1) return;
      lastY.current = y;

      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const progress = Math.min(y / threshold, 1);
        setInfo({
          progress,
          heroScale: lerp(1, 0.2, progress),
          heroOpacity: lerp(1, 0, Math.min(progress * 1.5, 1)),
          canvasScale: lerp(0.92, 1, progress),
          isCompressed: progress > 0.85,
        });
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll(); // initial state
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(rafRef.current);
    };
  }, [threshold]);

  return info;
}
