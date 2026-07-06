import type { MetadataRoute } from "next";

// Public, indexable routes only. Authenticated dashboard surfaces and
// token-carrying routes (/invite) are deliberately excluded.
const PUBLIC_PATHS = ["/", "/docs", "/terms", "/privacy", "/security", "/signup", "/login"];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const lastModified = new Date();
  return PUBLIC_PATHS.map((path) => ({
    url: new URL(path, base).toString(),
    lastModified,
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : 0.5
  }));
}
