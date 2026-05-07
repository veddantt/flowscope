// ─── Adaptive Layout Token System ─────────────────────────────────────────────
// Defines 3 interaction tiers based on available viewport space, not just
// device type. Every spacing, sizing, and radius value flows from these tokens.

export type LayoutTier = 'compact' | 'medium' | 'expanded';
export type InteractionMode = 'touch' | 'explore' | 'simulate';

// ─── Breakpoints ──────────────────────────────────────────────────────────────
export const BREAKPOINTS = {
  medium: 768,
  expanded: 1024,
} as const;

export function getTier(width: number): LayoutTier {
  if (width < BREAKPOINTS.medium) return 'compact';
  if (width < BREAKPOINTS.expanded) return 'medium';
  return 'expanded';
}

export function getInteractionMode(width: number): InteractionMode {
  if (width < BREAKPOINTS.medium) return 'touch';
  if (width < BREAKPOINTS.expanded) return 'explore';
  return 'simulate';
}

// ─── Layout Tokens ────────────────────────────────────────────────────────────
export const layout = {
  header: {
    compact: 56,
    medium: 64,
    expanded: 72,
  },
  canvasPadding: {
    compact: 8,
    medium: 16,
    expanded: 24,
  },
  sectionPadding: {
    compact: 16,
    medium: 24,
    expanded: 32,
  },
  panelRadius: {
    compact: 20,
    medium: 28,
    expanded: 32,
  },
  sidePanel: {
    width: 340,
  },
  hero: {
    // Max heights before scroll compression begins
    compact: 280,
    medium: 380,
    expanded: 520,
  },
} as const;

// ─── Canvas scaling ───────────────────────────────────────────────────────────
export function getCanvasScale(containerWidth: number): number {
  return Math.min(containerWidth / 1440, 1);
}

export function getNodeScale(mode: InteractionMode): number {
  switch (mode) {
    case 'touch': return 0.70;
    case 'explore': return 0.85;
    case 'simulate': return 1;
  }
}


