import Image from "next/image";

// Intrinsic ratio: 714 × 420 (≈ 1.7 : 1)
const RATIO = 714 / 420;

export function OdimLogo({ size = 30, className }: Readonly<{ size?: number; className?: string }>) {
  return (
    <Image
      src="/odim-logo.png"
      alt="Odim"
      width={Math.round(size * RATIO)}
      height={size}
      className={className}
      priority
    />
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
