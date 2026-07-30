import fs from "fs";
import path from "path";
import matter from "gray-matter";

const postsDirectory = path.join(process.cwd(), "content", "blog");

const BLOG_ORIGIN = "https://blog.ozigi.app";

/** Post/author images are stored as root-relative paths (e.g. "/images/blog/x/cover.svg").
 *  Posts render both natively at blog.ozigi.app and proxied at ozigi.app/blog — a root-relative
 *  path resolves against whichever host the browser is actually on, which 404s when proxied.
 *  Resolving to an absolute blog.ozigi.app URL makes it work from either context. */
function toAbsoluteBlogAsset<T extends string | null | undefined>(src: T): T {
  if (!src || /^https?:\/\//.test(src)) return src;
  return (`${BLOG_ORIGIN}${src.startsWith("/") ? "" : "/"}${src}`) as T;
}

export interface Heading {
  text: string;
  level: number;
  id: string;
}

export interface FAQ {
  question: string;
  answer: string;
}

export interface BlogPost {
  slug: string;
  title: string;
  date: string;
  /** ISO date string for the last time this article was meaningfully updated.
   *  Used in schema.org dateModified and sitemap lastModified.
   *  Falls back to `date` when absent. */
  modifiedTime?: string;
  excerpt?: string;
  description?: string;
  coverImage?: string;
  author?: string;
  authorImage?: string;
  authorBio?: string;
  authorUrl?: string;
  authorHandle?: string;
  readTime?: string;
  categories?: string[];
  section?: string;
  keywords?: string[];
  content: string;
  headings: Heading[];
  faqs: FAQ[];
  [key: string]: unknown;
}

export function extractHeadings(content: string): Heading[] {
  // Remove code blocks to avoid picking up headings in code comments
  const contentWithoutCodeBlocks = content.replace(/```[\s\S]*?```/g, "");
  
  const headingRegex = /^(#{1,6})\s+(.+)$/gm;
  const headings: Heading[] = [];
  let match;
  while ((match = headingRegex.exec(contentWithoutCodeBlocks)) !== null) {
    const level = match[1].length;
    const text = match[2];
    const id = text
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .replace(/\s+/g, "-");
    headings.push({ text, level, id });
  }
  return headings;
}

function stripMarkdown(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

// Parses the "## Frequently Asked Questions" section into FAQPage-ready
// Q&A pairs. Relies on the site-wide convention of a bold question on its
// own line followed by a plain-text answer paragraph.
export function extractFAQs(content: string): FAQ[] {
  const headingMatch = content.match(/^##\s+Frequently Asked Questions.*$/im);
  if (!headingMatch || headingMatch.index === undefined) return [];

  const rest = content.slice(headingMatch.index + headingMatch[0].length);
  const endMatch = rest.match(/^##\s+.+$|^---\s*$/m);
  const section = endMatch && endMatch.index !== undefined ? rest.slice(0, endMatch.index) : rest;

  const faqs: FAQ[] = [];
  let currentQuestion: string | null = null;
  let currentAnswer: string[] = [];

  const flush = () => {
    if (currentQuestion && currentAnswer.length > 0) {
      faqs.push({
        question: stripMarkdown(currentQuestion),
        answer: stripMarkdown(currentAnswer.join(" ").replace(/\s+/g, " ")),
      });
    }
  };

  // Questions appear either as a bold line (**Q?**) or a level-3 heading (### Q?)
  for (const rawLine of section.split("\n")) {
    const line = rawLine.trim();
    const questionMatch = line.match(/^\*\*(.+?)\*\*$/) || line.match(/^#{3}\s+(.+)$/);
    if (questionMatch) {
      flush();
      currentQuestion = questionMatch[1];
      currentAnswer = [];
    } else if (line && currentQuestion) {
      currentAnswer.push(line);
    }
  }
  flush();

  return faqs;
}

function parseCategories(data: Record<string, unknown>): string[] {
  if (data.categories) {
    return Array.isArray(data.categories) ? data.categories : [String(data.categories)];
  }
  if (data.category) {
    return String(data.category).split(',').map((c: string) => c.trim());
  }
  return [];
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export function calculateWordCount(content: string): number {
  const plainText = content
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`]*`/g, "")
    .replace(/[#*_\[\]()]/g, "");
  return plainText.split(/\s+/).filter(word => word.length > 0).length;
}

export function estimateReadTime(content: string, readSpeed: number = 200): string {
  const wordCount = calculateWordCount(content);
  const minutes = Math.ceil(wordCount / readSpeed);
  return `${minutes} min read`;
}

export async function getAllPosts(): Promise<BlogPost[]> {
  // Check if directory exists
  if (!fs.existsSync(postsDirectory)) {
    console.error(`Blog posts directory not found: ${postsDirectory}`);
    return [];
  }

  const files = fs.readdirSync(postsDirectory);
  const posts = files
    .filter((filename) => filename.endsWith('.md') || filename.endsWith('.mdx'))
 .map((filename): BlogPost | null => {
      try {
        const slug = filename.replace(/\.mdx?$/, "");
        const filePath = path.join(postsDirectory, filename);
                const fileContent = fs.readFileSync(filePath, "utf-8");
        const { data, content } = matter(fileContent);

        // Validate required fields
        if (!data.title) {
          console.warn(`Post ${slug} is missing a title`);
        }

        return {
          ...data,
          slug,
          title: data.title || 'Untitled',
          date: data.date || new Date().toISOString().split('T')[0],
          modifiedTime: data.modifiedTime || data.lastModified || undefined,
          excerpt: data.excerpt || data.description,
          description: data.description || data.excerpt,
          coverImage: toAbsoluteBlogAsset(data.coverImage),
          author: data.author,
          authorImage: toAbsoluteBlogAsset(data.authorImage),
          authorBio: data.authorBio,
          authorUrl: data.authorUrl,
          authorHandle: data.authorHandle,
          readTime: data.readTime,
          categories: parseCategories(data),
          section: data.section,
          content,
          headings: extractHeadings(content),
          faqs: extractFAQs(content),
        } as BlogPost;
      } catch (error) {
        console.error(`Error processing blog post ${filename}:`, error);
        return null;
      }
    })
    .filter((post): post is BlogPost => post !== null);

  const now = Date.now();

  return posts
    .filter((post) => {
      if (!post.date) return true;
      try {
        const ds = post.date.includes('T') ? post.date : `${post.date}T00:00:00Z`;
        return new Date(ds).getTime() <= now;
      } catch {
        return true;
      }
    })
    .sort((a, b) => {
      try {
        const dateStringA = a.date ? (a.date.includes('T') ? a.date : `${a.date}T00:00:00Z`) : null;
        const dateStringB = b.date ? (b.date.includes('T') ? b.date : `${b.date}T00:00:00Z`) : null;

        const dateA = dateStringA ? new Date(dateStringA).getTime() : 0;
        const dateB = dateStringB ? new Date(dateStringB).getTime() : 0;

        return dateB - dateA;
      } catch (error) {
        console.warn('Error sorting posts by date:', error);
        return 0;
      }
    });
}

export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
  try {
    const filePath = path.join(postsDirectory, `${slug}.mdx`);
    const fileContent = fs.readFileSync(filePath, "utf-8");
    const { data, content } = matter(fileContent);

    // Don't serve posts with a future publish date
    if (data.date) {
      try {
        const ds = String(data.date).includes('T') ? String(data.date) : `${data.date}T00:00:00Z`;
        if (new Date(ds).getTime() > Date.now()) return null;
      } catch { /* fall through */ }
    }

    return {
      ...data,
      slug,
      title: data.title,
      date: data.date,
      modifiedTime: data.modifiedTime || data.lastModified || undefined,
      excerpt: data.excerpt || data.description,
      description: data.description || data.excerpt,
      coverImage: toAbsoluteBlogAsset(data.coverImage) || null,
      author: data.author,
      authorImage: toAbsoluteBlogAsset(data.authorImage) || null,
      authorBio: data.authorBio || null,
      authorUrl: data.authorUrl || null,
      authorHandle: data.authorHandle || null,
      readTime: data.readTime,
      categories: parseCategories(data),
      section: data.section || null,
      content,
      headings: extractHeadings(content),
      faqs: extractFAQs(content),
    };
  } catch {
    return null;
  }
}

export async function getRelatedPosts(categories: string[], currentSlug: string): Promise<BlogPost[]> {
  const allPosts = await getAllPosts();
  return allPosts
    .filter((post) => {
      if (post.slug === currentSlug) return false;
      if (!post.categories || post.categories.length === 0) return false;
      // If any of the current post's categories match any of the other post's categories
      return post.categories.some(cat => categories.includes(cat));
    })
    .slice(0, 3);
}

export function getAllSections(): string[] {
  return ["Engineering", "Marketing", "Content", "WordPress", "Security", "Tools Roundup", "Ozigi Focus"];
}

export interface SectionMeta {
  title: string;
  description: string;
  examples: string[];
  wordCount: string;
}

export const SECTION_META: Record<string, SectionMeta> = {
  "Engineering": {
    title: "Engineering",
    description: "Technical deep dives, architecture decisions, and how we build Ozigi. Share your engineering insights, best practices, and technical lessons learned.",
    examples: [
      "Building scalable systems",
      "API design patterns",
      "Performance optimization",
      "Database architecture",
      "DevOps & deployment"
    ],
    wordCount: "1,500-3,000 words"
  },
  "Marketing": {
    title: "Marketing",
    description: "Growth strategies, go-to-market playbooks, and how to build authentic marketing that resonates. Share what's working in your marketing.",
    examples: [
      "Launch strategies",
      "Growth hacking",
      "Community building",
      "Viral content tactics",
      "Paid advertising insights"
    ],
    wordCount: "1,200-2,500 words"
  },
  "Content": {
    title: "Content",
    description: "Content strategy, copywriting, and the craft of communicating ideas. Share frameworks for creating engaging content at scale.",
    examples: [
      "Content strategy frameworks",
      "Writing better copy",
      "Storytelling techniques",
      "Audience research",
      "Content distribution"
    ],
    wordCount: "1,000-2,000 words"
  },
  "WordPress": {
    title: "WordPress",
    description: "WordPress tutorials, troubleshooting guides, optimization strategies, and best practices. Share your WordPress expertise and solutions for common challenges.",
    examples: [
      "Troubleshooting guides",
      "Performance optimization",
      "Security hardening",
      "Plugin development",
      "WordPress migration",
      "SEO optimization"
    ],
    wordCount: "1,200-2,500 words"
  },
  "Tools Roundup": {
    title: "Tools Roundup",
    description: "Reviews of developer tools, SaaS products, and platforms. Share honest assessments of what works and what doesn't.",
    examples: [
      "API platform reviews",
      "DevOps tool comparisons",
      "SaaS product deep dives",
      "Open source alternatives",
      "Developer tooling updates"
    ],
    wordCount: "1,500-2,500 words"
  },
  "Security": {
    title: "Security",
    description: "Vulnerability research, threat modeling, secure architecture patterns, and how we think about keeping Ozigi and user data safe. Practical, opinionated guides for developers and founders building production systems that need to stay secure under pressure.",
    examples: [
      "API authentication & authorization",
      "Threat modeling for SaaS",
      "Vulnerability disclosure",
      "Secure deployment practices",
      "Rate limiting & abuse prevention",
      "Secrets management"
    ],
    wordCount: "1,500-3,000 words"
  },
  "Ozigi Focus": {
    title: "Ozigi Focus",
    description: "Product updates, changelogs, roadmap insights, and how we're building Ozigi. Behind-the-scenes looks at product development.",
    examples: [
      "Feature releases",
      "Product roadmap",
      "Technical implementations",
      "User stories",
      "Lessons learned"
    ],
    wordCount: "1,000-2,000 words"
  }
};

export async function getPostsBySection(section: string): Promise<BlogPost[]> {
  const allPosts = await getAllPosts();
  return allPosts.filter((post) => post.section === section);
}
