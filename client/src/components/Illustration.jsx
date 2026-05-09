/**
 * Inline SVG illustrations. All use CSS variables (var(--color-accent),
 * var(--color-accent-soft), etc.) so they recolor with the theme.
 */

export function LibraryStack({ size = 200, className = '' }) {
  return (
    <svg
      width={size}
      height={size * 0.78}
      viewBox="0 0 240 188"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={`block animate-library-float origin-center ${className}`}
    >
      <defs>
        <radialGradient id="lib-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.32" />
          <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="120" cy="100" rx="110" ry="60" fill="url(#lib-glow)" />

      <rect
        x="48" y="68" width="148" height="96" rx="6"
        fill="var(--color-surface)"
        stroke="var(--color-line-strong)"
        strokeWidth="1.2"
        transform="rotate(-6 122 116)"
      />
      <rect
        x="56" y="46" width="148" height="96" rx="6"
        fill="var(--color-surface)"
        stroke="var(--color-line-strong)"
        strokeWidth="1.2"
        transform="rotate(3 130 94)"
      />
      <g transform="rotate(-1 120 80)">
        <rect
          x="52" y="32" width="148" height="96" rx="6"
          fill="var(--color-surface)"
          stroke="var(--color-accent)"
          strokeWidth="1.6"
        />
        <rect x="68" y="50" width="58" height="6" rx="2" fill="var(--color-accent)" opacity="0.9" />
        <rect x="68" y="64" width="110" height="3" rx="1.5" fill="var(--color-subtle)" opacity="0.55" />
        <rect x="68" y="74" width="92" height="3" rx="1.5" fill="var(--color-subtle)" opacity="0.45" />
        <rect x="68" y="84" width="100" height="3" rx="1.5" fill="var(--color-subtle)" opacity="0.45" />
        <rect x="68" y="94" width="68" height="3" rx="1.5" fill="var(--color-subtle)" opacity="0.35" />
        <circle cx="178" cy="50" r="2.5" fill="var(--color-accent)" />
      </g>
    </svg>
  );
}

export function Spark({ size = 120, className = '' }) {
  const rays = [
    { angle: 0,   len: 26 },
    { angle: 45,  len: 18 },
    { angle: 90,  len: 26 },
    { angle: 135, len: 18 },
    { angle: 180, len: 26 },
    { angle: 225, len: 18 },
    { angle: 270, len: 26 },
    { angle: 315, len: 18 },
  ];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={`block animate-spark-float origin-center ${className}`}
    >
      <circle cx="60" cy="60" r="42" fill="var(--color-accent-soft)" opacity="0.7" />
      <g
        stroke="var(--color-accent)"
        strokeWidth="2"
        strokeLinecap="round"
      >
        {rays.map((r) => {
          const rad = (r.angle * Math.PI) / 180;
          const x1 = 60 + Math.cos(rad) * 22;
          const y1 = 60 + Math.sin(rad) * 22;
          const x2 = 60 + Math.cos(rad) * (22 + r.len);
          const y2 = 60 + Math.sin(rad) * (22 + r.len);
          return <line key={r.angle} x1={x1} y1={y1} x2={x2} y2={y2} />;
        })}
      </g>
      <circle cx="60" cy="60" r="14" fill="var(--color-accent)" />
      <circle cx="60" cy="60" r="6" fill="var(--color-surface)" opacity="0.9" />
      <circle cx="22" cy="20" r="1.6" fill="var(--color-accent)" opacity="0.7" />
      <circle cx="98" cy="100" r="1.6" fill="var(--color-accent)" opacity="0.7" />
      <circle cx="100" cy="22" r="1.2" fill="var(--color-accent)" opacity="0.5" />
      <circle cx="20" cy="96" r="1.2" fill="var(--color-accent)" opacity="0.5" />
    </svg>
  );
}

export function PaperPlane({ size = 180, className = '' }) {
  return (
    <svg
      width={size}
      height={size * 0.7}
      viewBox="0 0 200 140"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={`block animate-plane-float origin-center ${className}`}
    >
      <g stroke="var(--color-subtle)" strokeWidth="1.5" strokeLinecap="round" opacity="0.55">
        <line x1="14" y1="76" x2="46" y2="76" />
        <line x1="22" y1="92" x2="56" y2="92" />
        <line x1="30" y1="60" x2="58" y2="60" />
      </g>
      <path
        d="M 70 88 L 178 28 L 134 102 L 110 80 L 70 88 Z"
        fill="var(--color-surface)"
        stroke="var(--color-accent)"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M 110 80 L 178 28 L 134 102 Z"
        fill="var(--color-accent-soft)"
        stroke="var(--color-accent)"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <text
        x="160" y="20"
        fontFamily="var(--font-display)"
        fontSize="14"
        fontWeight="600"
        fill="var(--color-accent)"
        opacity="0.6"
      >?</text>
      <text
        x="184" y="56"
        fontFamily="var(--font-display)"
        fontSize="10"
        fontWeight="600"
        fill="var(--color-accent)"
        opacity="0.4"
      >?</text>
    </svg>
  );
}
