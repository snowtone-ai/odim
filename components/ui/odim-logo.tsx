import Image from "next/image";

export function OdimLogo({
  size = 30,
  className,
  priority = false
}: Readonly<{ size?: number; className?: string; priority?: boolean }>) {
  return (
    <Image
      src="/brand/odim-mark.png"
      alt=""
      width={size}
      height={size}
      sizes={`${size}px`}
      className={className}
      style={{ width: size, height: size, aspectRatio: "1 / 1", objectFit: "contain" }}
      priority={priority}
    />
  );
}

/** Compact wordmark for mobile / branding contexts */
export function OdimWordmark({ className }: Readonly<{ className?: string }>) {
  return (
    <span
      className={`font-[var(--font-plex-sans)] text-[15px] font-semibold tracking-[0.08em] ${className ?? ""}`}
      style={{ color: "var(--text-primary)" }}
    >
      ODIM
    </span>
  );
}
