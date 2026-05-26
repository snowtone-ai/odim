"use client";

import { useRouter } from "next/navigation";

type Props = {
  id: string;
  label: string;
};

export function EntityLink({ id, label }: Readonly<Props>) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.push(`/entity?id=${encodeURIComponent(id)}`)}
      className="transition-colors duration-[var(--dur-fast)]"
      style={{
        color: "var(--rune)",
        textDecoration: "underline",
        textDecorationColor: "rgba(201,169,97,0.30)",
        textUnderlineOffset: "2px",
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: 0,
        font: "inherit"
      }}
      title={`View entity: ${label}`}
    >
      {label}
    </button>
  );
}
