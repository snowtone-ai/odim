import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sign In" };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div
        className="max-w-md rounded-[var(--radius-md)] p-6"
        style={{ background: "var(--surface-primary)", border: "1px solid var(--line-faint)" }}
      >
        <h1 className="text-lg" style={{ color: "var(--text-primary)" }}>Enterprise Sign-In Required</h1>
        <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
          Complete SSO with your identity provider, then return through `/api/auth/callback`.
        </p>
        <p className="mt-4 text-[12px]" style={{ color: "var(--text-tertiary)" }}>
          New to Odim?{" "}
          <a href="/signup" style={{ color: "var(--rune)" }}>
            Create a workspace →
          </a>
        </p>
      </div>
    </main>
  );
}
