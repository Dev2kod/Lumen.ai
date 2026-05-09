import { useState } from 'react';

export default function Flashcard({ card, index }) {
  const [flipped, setFlipped] = useState(false);
  const num = String(index + 1).padStart(2, '0');

  return (
    <div
      className="relative cursor-pointer select-none [perspective:1200px]"
      onClick={() => setFlipped((f) => !f)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setFlipped((f) => !f);
        }
      }}
      aria-label={`Flashcard ${index + 1}, click to flip`}
    >
      <div
        className={`relative min-h-[110px] [transform-style:preserve-3d] transition-transform duration-150 ease-out ${
          flipped ? 'flashcard-flipped' : ''
        }`}
      >
        <Face num={num} variant="front">
          <div className="font-display text-lg leading-tight font-medium tracking-[-0.01em] pr-10">
            {card.q}
          </div>
        </Face>
        <Face num={num} variant="back">
          <div className="text-sm leading-relaxed text-ink pr-10">
            {card.a}
          </div>
        </Face>
      </div>
    </div>
  );
}

function Face({ num, variant, children }) {
  const base =
    'absolute inset-0 [backface-visibility:hidden] border border-line rounded-sm px-6 py-5 flex items-center group-hover:border-line-strong';
  const skin = variant === 'back' ? 'bg-sunken [transform:rotateX(180deg)]' : 'bg-surface';
  return (
    <div className={`${base} ${skin}`}>
      <span className="absolute top-3.5 right-[18px] font-mono text-[11px] text-subtle">
        {num}
      </span>
      {children}
    </div>
  );
}
