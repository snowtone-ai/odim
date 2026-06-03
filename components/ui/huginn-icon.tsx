import Image from "next/image";

// Intrinsic ratio: 1011 × 674 (≈ 1.5 : 1)
const RATIO = 1011 / 674;

export function HuginnIcon({ size = 24, className }: Readonly<{ size?: number; className?: string }>) {
  return (
    <Image
      src="/huginn-icon.png"
      alt="Huginn"
      width={Math.round(size * RATIO)}
      height={size}
      className={className}
    />
  );
}
