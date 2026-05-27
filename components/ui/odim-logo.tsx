/**
 * Odim Logo — stylized "O" with inner eye motif.
 * Represents all-seeing intelligence across reality layers.
 */
export function OdimLogo({ size = 32, className }: Readonly<{ size?: number; className?: string }>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Outer ring */}
      <circle
        cx="16"
        cy="16"
        r="14"
        stroke="var(--text-primary)"
        strokeWidth="1.5"
        opacity="0.7"
      />
      {/* Inner orbit — tilted ellipse suggesting global surveillance */}
      <ellipse
        cx="16"
        cy="16"
        rx="10"
        ry="5.5"
        stroke="var(--rune)"
        strokeWidth="1.2"
        opacity="0.6"
        transform="rotate(-20 16 16)"
      />
      {/* Core — the eye / focal point */}
      <circle
        cx="16"
        cy="16"
        r="3"
        fill="var(--rune)"
        opacity="0.9"
      />
      {/* Inner highlight */}
      <circle
        cx="15"
        cy="15"
        r="1"
        fill="var(--rune-bright)"
        opacity="0.5"
      />
    </svg>
  );
}

/** Compact wordmark for mobile / branding contexts */
export function OdimWordmark({ className }: Readonly<{ className?: string }>) {
  return (
    <span
      className={`font-[var(--font-spectral)] text-[15px] font-semibold tracking-[0.08em] ${className ?? ""}`}
      style={{ color: "var(--text-primary)" }}
    >
      ODIM
    </span>
  );
}
