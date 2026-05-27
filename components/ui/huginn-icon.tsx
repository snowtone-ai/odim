/**
 * Huginn Icon — Odin's raven of thought, stylized as an intelligence sigil.
 * Abstract geometric raven: angular wing silhouette with a piercing eye,
 * evoking surveillance and analytical cognition.
 */
export function HuginnIcon({ size = 24, className }: Readonly<{ size?: number; className?: string }>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Wing — sharp angular stroke suggesting flight and reach */}
      <path
        d="M3 8 L8 4 L13 7 L18 3 L21 6 L17 10 L20 14 L15 13 L12 17 L8 14 L4 16 Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
        fill="none"
        opacity="0.75"
      />
      {/* Head / beak — decisive forward vector */}
      <path
        d="M13 7 L17 10 L14 11.5 Z"
        fill="currentColor"
        opacity="0.5"
      />
      {/* Eye — the seat of Huginn's thought */}
      <circle
        cx="14.5"
        cy="9"
        r="1.5"
        fill="currentColor"
        opacity="0.9"
      />
      {/* Tail feathers — trailing data streams */}
      <path
        d="M4 16 L3 20"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.35"
      />
      <path
        d="M8 14 L6 19"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.35"
      />
    </svg>
  );
}
