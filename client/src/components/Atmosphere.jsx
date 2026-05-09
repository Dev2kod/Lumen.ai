/**
 * Drifting gradient orbs that sit behind content. Pure CSS, GPU-cheap.
 * The parent surface needs `relative overflow-hidden` (.hero and .source-cover do).
 */
const HERO_BLOBS = [
  {
    cls: 'top-[-140px] left-[-160px] w-[480px] h-[480px] animate-drift-a',
    style: { background: 'radial-gradient(circle, var(--blob-1), transparent 65%)' },
  },
  {
    cls: 'top-[22%] right-[-140px] w-[420px] h-[420px] animate-drift-b',
    style: { background: 'radial-gradient(circle, var(--blob-2), transparent 65%)' },
  },
  {
    cls: 'bottom-[-140px] left-[34%] w-[360px] h-[360px] animate-drift-c',
    style: { background: 'radial-gradient(circle, var(--blob-3), transparent 70%)' },
  },
];

const COVER_BLOBS = [
  {
    cls: 'top-[-100px] right-[-120px] w-[320px] h-[320px] animate-drift-a',
    style: { background: 'radial-gradient(circle, var(--blob-cover-1), transparent 65%)' },
  },
  {
    cls: 'bottom-[-100px] left-[-80px] w-[260px] h-[260px] animate-drift-b',
    style: { background: 'radial-gradient(circle, var(--blob-cover-2), transparent 70%)' },
  },
];

export default function Atmosphere({ variant = 'hero' }) {
  const blobs = variant === 'hero' ? HERO_BLOBS : COVER_BLOBS;
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {blobs.map((b, i) => (
        <span
          key={i}
          className={`absolute rounded-full blur-[64px] will-change-transform ${b.cls}`}
          style={{ ...b.style, transform: 'translateZ(0)' }}
        />
      ))}
    </div>
  );
}
