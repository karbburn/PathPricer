import type { MetadataRoute } from "next";

const BASE = "https://pathpricer.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: BASE, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/workspace`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE}/validation`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/docs`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
  ];
}
