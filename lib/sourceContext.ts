import { extractYouTubeId, getYouTubeTranscript } from '@/lib/youtube';
import { fetchPageContent } from '@/lib/firecrawl';

const ARTICLE_FETCH_TIMEOUT_MS = 15_000;
const ARTICLE_MAX_CHARS = 8_000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    p.then((value) => { clearTimeout(timer); resolve(value); })
      .catch(() => { clearTimeout(timer); resolve(null); });
  });
}

/**
 * Resolves a pasted URL into real grounding content: YouTube transcript for
 * video links, scraped article markdown otherwise. Falls back to the bare
 * URL string if scraping fails/times out, since the model can still attempt
 * something rather than the request hard-failing.
 */
export async function resolveUrlContext(url: string): Promise<string> {
  if (!url) return url;

  const videoId = extractYouTubeId(url);
  if (videoId) {
    const transcript = await getYouTubeTranscript(videoId);
    return transcript ? `YouTube transcript: ${transcript}` : url;
  }

  const markdown = await withTimeout(fetchPageContent(url), ARTICLE_FETCH_TIMEOUT_MS);
  if (markdown && markdown.length > 0) {
    return `Article content scraped from ${url}:\n${markdown.slice(0, ARTICLE_MAX_CHARS)}`;
  }

  return url;
}
