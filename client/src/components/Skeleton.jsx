export default function Skeleton({
  width = '100%',
  height = 14,
  radius = 2,
  className = '',
  style = {},
}) {
  return (
    <span
      className={`inline-block bg-sunken border border-line align-middle animate-skeleton ${className}`}
      style={{
        width,
        height,
        borderRadius: radius,
        ...style,
      }}
      aria-hidden="true"
    />
  );
}
