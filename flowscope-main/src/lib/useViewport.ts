import { useState, useEffect, useCallback } from 'react';
import { getTier, getInteractionMode, type LayoutTier, type InteractionMode } from './layout';

export type ViewportInfo = {
  w: number;
  h: number;
  tier: LayoutTier;
  mode: InteractionMode;
  isMobile: boolean;
  isTablet: boolean;
};

/**
 * Pro-level viewport hook using resize events with debounce.
 * Returns computed tier & interaction mode automatically.
 */
export function useViewport(): ViewportInfo {
  const compute = useCallback((): ViewportInfo => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const tier = getTier(w);
    return {
      w,
      h,
      tier,
      mode: getInteractionMode(w),
      isMobile: tier === 'compact',
      isTablet: tier === 'medium',
    };
  }, []);

  const [info, setInfo] = useState<ViewportInfo>(compute);

  useEffect(() => {
    let rafId: number;
    const update = () => {
      rafId = requestAnimationFrame(() => setInfo(compute()));
    };

    update();
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('resize', update);
      cancelAnimationFrame(rafId);
    };
  }, [compute]);

  return info;
}
