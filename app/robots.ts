import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Authenticated dashboard surfaces, APIs, and token-carrying invite
        // links must not be crawled or indexed.
        disallow: [
          "/api/",
          "/map",
          "/entity",
          "/alerts",
          "/huginn",
          "/settings",
          "/custom",
          "/invite"
        ]
      }
    ],
    sitemap: new URL("/sitemap.xml", base).toString()
  };
}
