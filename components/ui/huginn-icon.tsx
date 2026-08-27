import Image from "next/image";

export function HuginnIcon({ size = 24, className }: Readonly<{ size?: number; className?: string }>) {
  return (
    <Image
      src="/brand/huginn-mark.png"
      alt=""
      width={size}
      height={size}
      sizes={`${size}px`}
      className={className}
      style={{ width: size, height: size, aspectRatio: "1 / 1", objectFit: "contain" }}
    />
  );
}
