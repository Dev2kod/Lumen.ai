import Spinner from './Spinner.jsx';

const BASE =
  'inline-flex items-center justify-center gap-2 px-4 py-[9px] text-sm font-medium rounded-sm border border-transparent select-none transition-[background-color,color,border-color] duration-100 disabled:opacity-50 disabled:cursor-not-allowed';

const VARIANTS = {
  primary:
    'bg-accent text-accent-on border-accent enabled:hover:bg-accent-hover enabled:hover:border-accent-hover',
  secondary:
    'bg-surface text-ink border-line-strong enabled:hover:border-ink',
  ghost:
    'text-muted bg-transparent enabled:hover:text-ink enabled:hover:bg-sunken',
  'danger-ghost':
    'text-muted bg-transparent enabled:hover:text-accent',
};

export default function Button({
  variant = 'secondary',
  type = 'button',
  loading = false,
  disabled = false,
  className = '',
  children,
  ...rest
}) {
  return (
    <button
      type={type}
      className={`${BASE} ${VARIANTS[variant] || VARIANTS.secondary} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}
