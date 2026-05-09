import { useState } from 'react';

const LETTERS = ['A', 'B', 'C', 'D'];

export default function QuizQuestion({ question, index }) {
  const [picked, setPicked] = useState(null);
  const answered = picked !== null;
  const correct = question.answer_index;

  function classFor(i) {
    const base =
      'flex items-start gap-3 px-3.5 py-3 border rounded-sm text-left text-sm leading-snug transition-[border-color,background-color,color] duration-100 disabled:cursor-default';
    if (!answered) return `${base} bg-surface border-line text-ink hover:border-ink cursor-pointer`;
    if (i === correct) return `${base} bg-accent-soft border-accent text-ink`;
    return `${base} bg-canvas border-line text-subtle`;
  }

  function markerClass(i) {
    if (answered && i === correct) return 'font-mono text-xs text-accent w-4 shrink-0 pt-px';
    return 'font-mono text-xs text-subtle w-4 shrink-0 pt-px';
  }

  return (
    <div className="py-6 border-b border-line last:border-b-0">
      <h3 className="font-display text-[17px] font-medium mb-4 tracking-[-0.005em]">
        <span className="text-subtle mr-2.5 font-mono text-[13px]">
          {String(index + 1).padStart(2, '0')}
        </span>
        {question.q}
      </h3>
      <div className="flex flex-col gap-2">
        {question.options.map((opt, i) => (
          <button
            key={i}
            className={classFor(i)}
            onClick={() => !answered && setPicked(i)}
            disabled={answered}
          >
            <span className={markerClass(i)}>{LETTERS[i]}</span>
            <span>{opt}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
