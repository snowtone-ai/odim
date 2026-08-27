import Link from "next/link";
import type { Metadata } from "next";
import { PublicAuthShell } from "@/components/ui/public-shell";

export const metadata: Metadata = { title: "Sign In" };

export default function LoginPage() {
  return (
    <PublicAuthShell
      eyebrow="ACCESS / ENTERPRISE"
      title="Enter the evidence workspace."
      description="Odim workspaces use your organization's identity provider so access, source context, and analyst actions remain scoped to the right team."
      footer={
        <p className="text-[12px]" style={{ color: "color-mix(in srgb, var(--text) 58%, transparent)" }}>
          New to Odim?{" "}
          <Link href="/signup" className="transition-colors duration-[var(--motion-micro)] hover:text-[var(--signal)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--signal)]" style={{ color: "var(--signal)" }}>
            Create a workspace <span aria-hidden="true">→</span>
          </Link>
        </p>
      }
    >
      <div>
        <p className="mono text-[11px] tracking-[0.14em]" style={{ color: "var(--evidence)" }}>
          SSO HANDOFF
        </p>
        <h2 className="mt-4 text-lg font-medium" style={{ color: "var(--text)" }}>
          Enterprise sign-in required
        </h2>
        <p className="mt-3 text-[14px] leading-6" style={{ color: "color-mix(in srgb, var(--text) 68%, transparent)" }}>
          Complete SSO with your identity provider, then return through{" "}
          <code className="mono text-[12px]" style={{ color: "var(--evidence)" }}>/api/auth/callback</code>.
        </p>
        <div className="mt-7 border-t pt-5" style={{ borderColor: "color-mix(in srgb, var(--text) 14%, transparent)" }}>
          <p className="text-[12px] leading-5" style={{ color: "color-mix(in srgb, var(--text) 48%, transparent)" }}>
            Your organization controls the identity provider and session policy. Odim does not create a second password for enterprise access.
          </p>
        </div>
      </div>
    </PublicAuthShell>
  );
}
