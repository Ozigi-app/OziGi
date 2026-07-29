import { getAllPosts } from "@/lib/blog";

export async function GET() {
  const posts = await getAllPosts();
  const baseUrl = "https://ozigi.app";
  const latestPosts = posts.slice(0, 20);

  const rssContent = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>Ozigi Blog - Insights, tutorials, and architecture for technical creators</title>
    <link>${baseUrl}/blog</link>
    <description>Insights, tutorials, and architecture for technical creators building products with Ozigi</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <docs>https://www.rssboard.org/rss-specification</docs>
    <generator>Ozigi Blog RSS Generator</generator>
    ${latestPosts.map(post => {
      // Safely parse date
      let pubDate: string;
      try {
        const dateString = post.date.includes('T') ? post.date : `${post.date}T00:00:00Z`;
        pubDate = new Date(dateString).toUTCString();
      } catch (error) {
        pubDate = new Date().toUTCString();
      }
      
      return `
    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${baseUrl}/blog/${post.slug}</link>
      <guid isPermaLink="true">${baseUrl}/blog/${post.slug}</guid>
      <description>${escapeXml(post.description || post.excerpt || "")}</description>
      <content:encoded><![CDATA[${post.description || post.excerpt || ""}]]></content:encoded>
      <pubDate>${pubDate}</pubDate>
      <author>${post.author ? `${post.author}@ozigi.app` : "blog@ozigi.app"}</author>
      ${post.section ? `<category>${escapeXml(post.section)}</category>` : ""}
      ${post.keywords && post.keywords.length > 0 ? post.keywords.map((keyword: string) => `<category>${escapeXml(keyword)}</category>`).join("\n      ") : ""}
      ${post.coverImage ? `<media:content url="${escapeXml(post.coverImage)}" medium="image"><media:title>${escapeXml(post.title)}</media:title></media:content>` : ""}
      <source url="${baseUrl}/blog/feed.xml">Ozigi Blog</source>
    </item>
    `;
    }).join("")}
  </channel>
</rss>`;

  return new Response(rssContent, {
    headers: {
      "Content-Type": "application/rss+xml; charset=UTF-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
