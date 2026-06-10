import { MetadataRoute } from "next";
import { getAllPosts, getAllSections } from "@/lib/blog";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://blog.ozigi.app";
  
  // Get all blog posts and sections
  const posts = await getAllPosts();
  const sections = getAllSections();
  
  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
  ];
  
  // Section pages (top-level for better SEO)
  const sectionPages: MetadataRoute.Sitemap = sections.map((section) => ({
    url: `${baseUrl}/${section.toLowerCase().replace(/\s+/g, "-")}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));
  
  // Dynamic blog post pages with image metadata
  const blogPages: MetadataRoute.Sitemap = posts
    .filter((post) => post.date) // Filter out posts without dates
    .map((post) => {
      // Prefer modifiedTime over date so updated articles surface correctly in Google
      let lastModified: Date;
      try {
        // Check if date already has time component
        const rawDate = post.modifiedTime || post.date;
        const dateString = rawDate.includes('T') ? rawDate : `${rawDate}T00:00:00Z`;
        const dateObj = new Date(dateString);
        
        // Validate the date is valid
        if (isNaN(dateObj.getTime())) {
          console.warn(`Invalid date for post ${post.slug}: ${post.date}, using current date`);
          lastModified = new Date();
        } else {
          lastModified = dateObj;
        }
      } catch (error) {
        console.warn(`Error parsing date for post ${post.slug}: ${post.date}, using current date`);
        lastModified = new Date();
      }
      
      return {
        url: `${baseUrl}/blog/${post.slug}`,
        lastModified,
        changeFrequency: "monthly" as const,
        priority: 0.9,
        ...(post.coverImage && {
          images: [post.coverImage],
        }),
      };
    });
  
  return [...staticPages, ...sectionPages, ...blogPages];
}
