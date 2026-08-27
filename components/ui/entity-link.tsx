"use client";

import { ArrowUpRight } from "lucide-react";
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
      className="inline-flex min-h-11 items-center gap-1 text-left text-[inherit] transition-colors duration-[var(--motion-micro)] hover:text-[var(--signal)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--signal)]"
      style={{ color: "var(--signal)", textDecoration: "underline", textDecorationColor: "var(--line-vivid)", textUnderlineOffset: "3px", background: "none", border: "none", cursor: "pointer", padding: 0, font: "inherit" }}
      aria-label={`View entity: ${label}`}
      title={`View entity: ${label}`}
    >
      {label}<ArrowUpRight size={13} aria-hidden="true" />
    </button>
  );
}
