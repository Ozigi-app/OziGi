import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const sitemap = "https://ozigi.app/sitemap.xml";

  const disallow = [
    "/dashboard/",
    "/api/",
    "/auth-error",
    "/reset-password",
    "/sentry-example-page",
  ];

  return {
    rules: [
      // Google
      {
        userAgent: "Googlebot",
        allow: "/",
        disallow,
      },
      // Bing
      {
        userAgent: "Bingbot",
        allow: "/",
        disallow,
      },
      // All other crawlers
      {
        userAgent: "*",
        allow: "/",
        disallow,
      },
    ],
    sitemap,
  };
}
