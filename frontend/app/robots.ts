import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
      },
      {
        userAgent: [
          "GPTBot",
          "ChatGPT-User",
          "PerplexityBot",
          "ClaudeBot",
          "Claude-Web",
          "Google-Extended",
          "Applebot-Extended",
          "cohere-ai",
        ],
        allow: "/",
      },
    ],
    sitemap: "https://pathpricer.vercel.app/sitemap.xml",
    host: "https://pathpricer.vercel.app",
  };
}
