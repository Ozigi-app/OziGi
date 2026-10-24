/**
 * Pure-logic regression tests (no browser, no server):
 *  - the newsletter preview formatter, so the "Subject:" line and paragraphs no
 *    longer collapse into one block
 *  - the long-form authority audit, so headings and phrases are not flagged as
 *    people while real attributions still are
 */

import { test, expect } from "@playwright/test";
import { plainTextToEmailHtml } from "../lib/email-format";
import { auditAuthorities } from "../lib/longform/audit-authorities";

const BUDGET = [
  {
    url: "https://www.orbitmedia.com/blog/blogging-statistics/",
    justification: "industry data",
    status: "resolved",
  },
] as any;

test.describe("plainTextToEmailHtml", () => {
  test("puts the subject and each paragraph on its own line", () => {
    const html = plainTextToEmailHtml(
      "Subject: The frequency trap\nWe spent six months chasing volume.\nOpen rates were flat."
    );
    expect(html).toBe(
      "<p><strong>Subject: The frequency trap</strong></p><p>We spent six months chasing volume.</p><p>Open rates were flat.</p>"
    );
  });

  test("handles headings, lists and inline emphasis", () => {
    const html = plainTextToEmailHtml("### The fix\n- one idea\n- one subject\nWe moved to **weekly**.");
    expect(html).toContain("<h3>The fix</h3>");
    expect(html).toContain("<ul><li>one idea</li><li>one subject</li></ul>");
    expect(html).toContain("<strong>weekly</strong>");
  });

  test("leaves existing HTML untouched", () => {
    expect(plainTextToEmailHtml("<p>Already <b>html</b></p>")).toBe("<p>Already <b>html</b></p>");
  });

  test("escapes markup in plain text", () => {
    expect(plainTextToEmailHtml("a < b & c")).toBe("<p>a &lt; b &amp; c</p>");
  });

  test("returns an empty string for empty input", () => {
    expect(plainTextToEmailHtml(null)).toBe("");
    expect(plainTextToEmailHtml("")).toBe("");
  });
});

test.describe("auditAuthorities", () => {
  test("does not flag headings, phrases or code as people", () => {
    const draft = [
      "## Prerequisites for a Sustainable Cadence",
      "Most teams treat blogging as a distraction. Audit Recent team activity. Distill Single Lesson.",
      "```",
      "const Martin Fowler = 1",
      "```",
    ].join("\n");
    expect(auditAuthorities(draft, BUDGET)).toHaveLength(0);
  });

  test("still flags a named person cited as an authority who is not in the sources", () => {
    const flags = auditAuthorities(
      "According to Jane Smith, retries need idempotency. Kent Beck, creator of extreme programming, disagrees. Martin Fowler argues for small steps.",
      BUDGET
    );
    expect(flags.map((f) => f.span_text).sort()).toEqual(["Jane Smith", "Kent Beck", "Martin Fowler"]);
  });

  test("does not flag an authority that appears in the source budget", () => {
    expect(auditAuthorities("According to Orbit Media, bloggers spend hours.", BUDGET)).toHaveLength(0);
  });
});
