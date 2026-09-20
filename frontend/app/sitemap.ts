import type { MetadataRoute } from "next";

const BASE = "https://pathpricer.sourabhpradhan.in";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: BASE,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1.0,
      images: [`${BASE}/pathpricer.png`],
    },
    {
      url: `${BASE}/workspace`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
      images: [`${BASE}/pathpricer.png`],
    },
    {
      url: `${BASE}/workspace/strategy`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
      images: [`${BASE}/pathpricer.png`],
    },
    {
      url: `${BASE}/docs`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
      images: [`${BASE}/pathpricer.png`],
    },
    {
      url: `${BASE}/validation`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
      images: [`${BASE}/pathpricer.png`],
    },
  ];
}
