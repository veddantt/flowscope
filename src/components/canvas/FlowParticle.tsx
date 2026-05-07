"use client";

export function FlowParticle({ path, delay = 0, duration = 2.2, color = '#38bdf8', size = 4, cinematic = false }: {
  path: string; delay?: number; duration?: number; color?: string; size?: number; cinematic?: boolean;
}) {
  const d = cinematic ? duration * 1.6 : duration;
  
  return (
    <g>
      {/* Kinetic Glow Trail */}
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={size * 1.5}
        strokeLinecap="round"
        strokeOpacity="0.15"
        style={{ filter: `blur(${size}px)` }}
      >
        <animate
          attributeName="stroke-dasharray"
          from={`0, 1000`}
          to={`100, 1000`}
          dur={`${d}s`}
          begin={`${delay}s`}
          repeatCount="indefinite"
        />
        <animate
          attributeName="stroke-dashoffset"
          from="0"
          to="-1000"
          dur={`${d}s`}
          begin={`${delay}s`}
          repeatCount="indefinite"
        />
      </path>

      {/* Particle Core */}
      <circle r={size * 2.6} fill={`${color}25`} style={{ filter: `blur(${size}px)` }}>
        <animateMotion dur={`${d}s`} begin={`${delay}s`} repeatCount="indefinite" path={path} />
      </circle>
      <circle r={size} fill={color}>
        <animateMotion dur={`${d}s`} begin={`${delay}s`} repeatCount="indefinite" path={path} />
      </circle>
      <circle r={size * 0.35} fill="rgba(255,255,255,0.9)">
        <animateMotion dur={`${d}s`} begin={`${delay}s`} repeatCount="indefinite" path={path} />
      </circle>
    </g>
  );
}
