/**
 * Newsletter drafts come back as plain text: a "Subject:" line, then paragraphs
 * separated by single line breaks (see the email format in lib/prompts.ts).
 * The dashboard renders that string as HTML, where line breaks collapse, so the
 * subject ran straight into the first paragraph.
 *
 * This converts plain text to HTML for DISPLAY and for the editor only. The stored
 * and scheduled content is left alone: the send path (app/api/qstash/publish) already
 * handles plain text and extracts the subject itself.
 */

const HTML_TAG_RE = /<[a-z][\s\S]*>/i;

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function inline(s: string): string {
  return escapeHtml(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*(?!\s)(.+?)(?<!\s)\*(?=[\s).,;:!?]|$)/g, '$1<em>$2</em>')
    .replace(/(^|[\s(])_(?!\s)(.+?)(?<!\s)_(?=[\s).,;:!?]|$)/g, '$1<em>$2</em>');
}

export function plainTextToEmailHtml(text: string | null | undefined): string {
  if (!text) return '';
  // Already HTML (for example after the rich text editor saved it): leave untouched.
  if (HTML_TAG_RE.test(text)) return text;

  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];
  let list: 'ul' | 'ol' | null = null;

  const closeList = () => {
    if (list) {
      out.push(`</${list}>`);
      list = null;
    }
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      closeList();
      continue;
    }

    const subject = line.match(/^subject:\s*(.+)$/i);
    if (subject) {
      closeList();
      out.push(`<p><strong>Subject: ${inline(subject[1])}</strong></p>`);
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      closeList();
      out.push(`<h3>${inline(heading[2])}</h3>`);
      continue;
    }

    const bullet = line.match(/^[-*•]\s+(.+)$/);
    if (bullet) {
      if (list !== 'ul') {
        closeList();
        out.push('<ul>');
        list = 'ul';
      }
      out.push(`<li>${inline(bullet[1])}</li>`);
      continue;
    }

    const numbered = line.match(/^\d+[.)]\s+(.+)$/);
    if (numbered) {
      if (list !== 'ol') {
        closeList();
        out.push('<ol>');
        list = 'ol';
      }
      out.push(`<li>${inline(numbered[1])}</li>`);
      continue;
    }

    closeList();
    out.push(`<p>${inline(line)}</p>`);
  }

  closeList();
  return out.join('');
}
