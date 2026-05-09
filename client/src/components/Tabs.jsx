export default function Tabs({ tabs, current, onChange }) {
  return (
    <div className="flex gap-7 border-b border-line" role="tablist">
      {tabs.map((t) => {
        const selected = current === t.id;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(t.id)}
            className={[
              'bg-transparent border-0 py-3 -mb-px font-sans text-sm font-medium cursor-pointer',
              'border-b border-transparent transition-[color,border-color] duration-100',
              selected ? 'text-ink border-accent' : 'text-muted hover:text-ink',
            ].join(' ')}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
