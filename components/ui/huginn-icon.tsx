import Image from "next/image";

export function HuginnIcon({ size = 24, className }: Readonly<{ size?: number; className?: string }>) {
  return (
    <Image
      src="/huginn-icon.png"
      alt="Huginn"
      width={size}
      height={size}
      className={className}
    />
  );
}
