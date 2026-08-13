/**
 * FAQPage JSON-LD source for the architecture deep dives.
 * Guide pages don't carry FAQ schema — they're procedural, not question-shaped.
 */
export const FAQ_DATA: Record<string, { question: string; answer: string }[]> = {
  "multimodal-pipeline": [
    {
      question: "What is Ozigi's Multimodal Ingestion Pipeline?",
      answer:
        "Ozigi's Context Engine ingests raw unstructured data — meeting transcripts, brain dumps, PDFs, images, audio, video, and URLs — and extracts the core narrative without requiring you to clean up or summarize anything first. You dump the raw material, the engine handles extraction, and you get a structured draft ready for finishing.",
    },
    {
      question: "What file types does Ozigi support for content ingestion?",
      answer:
        "Ozigi supports a wide range of input types including plain text, meeting transcripts, voice memos, PDFs, images, audio files, video files, and URLs. The multimodal pipeline processes each format and extracts relevant context for content generation.",
    },
    {
      question: "How does Ozigi solve the blank page problem?",
      answer:
        "Instead of starting from scratch, Ozigi lets you dump raw, unstructured material — notes, recordings, screenshots — and the Context Engine extracts what matters. This eliminates the blank page problem because you always start with your existing ideas, just organized and ready to expand.",
    },
    {
      question: "Do I need to format my inputs before using Ozigi?",
      answer:
        "No. Ozigi is designed to accept messy, unstructured inputs. The multimodal pipeline handles extraction and structuring automatically, so you can paste raw meeting notes, upload voice memos, or drop in screenshots without any preprocessing.",
    },
  ],
  "the-banned-lexicon": [
    {
      question: "What is the Banned Lexicon in Ozigi?",
      answer:
        "The Banned Lexicon is a hard-coded list of overused AI words and phrases — like 'delve,' 'tapestry,' 'robust,' and 'thrilled to announce' — that Ozigi blocks at the API level. This forces the model to find direct, precise phrasing instead of defaulting to corporate buzzwords.",
    },
    {
      question: "Why does AI-generated content sound generic?",
      answer:
        "AI models default to statistically common tokens — words that appear frequently in training data. This creates a 'statistical mean' problem where outputs converge on the same overused phrases. The Banned Lexicon breaks this pattern by blocking high-frequency filler words.",
    },
    {
      question: "How does the Banned Lexicon help content pass AI detectors?",
      answer:
        "By blocking predictable, high-frequency tokens, the Banned Lexicon raises perplexity and burstiness in the output. These are the same metrics AI detectors use to flag synthetic content. Higher variance in word choice makes the content read more like human writing.",
    },
    {
      question: "Can I customize the Banned Lexicon?",
      answer:
        "Yes. While Ozigi ships with a default list of banned words based on analysis of AI-generated content patterns, you can add industry-specific terms or phrases you want to avoid in your own content.",
    },
  ],
  "system-personas": [
    {
      question: "What are System Personas in Ozigi?",
      answer:
        "System Personas are database-backed editorial briefs that define who the AI is writing as — not what to write. A persona includes identity markers (expertise, years of experience), stylistic constraints (sentence length, tone, humor), and formatting rules. This produces first drafts that sound like a specific person, not a generic model.",
    },
    {
      question: "How are System Personas different from prompts?",
      answer:
        "Prompts tell AI what to write; personas tell AI who it is. Instead of saying 'write a blog post about X,' a persona establishes identity ('pragmatic Staff Engineer with 10 years of experience'), voice ('short punchy sentences, dry humor, no emojis'), and constraints. The content becomes a natural output of that identity.",
    },
    {
      question: "Why do System Personas produce more authentic content?",
      answer:
        "When you define identity before task, the AI doesn't just complete a request — it adopts a perspective. Combined with the Banned Lexicon, this prevents the model from averaging across millions of documents and instead produces content with a consistent, recognizable voice.",
    },
    {
      question: "Can I create multiple personas for different content types?",
      answer:
        "Yes. You can create and switch between multiple personas — one for technical documentation, another for social media, another for thought leadership. Each persona maintains its own voice, constraints, and formatting rules.",
    },
  ],
  "human-in-the-loop": [
    {
      question: "What is Human-in-the-Loop in Ozigi?",
      answer:
        "Human-in-the-Loop is Ozigi's core philosophy: the engine handles 90% of the work (ingestion, extraction, drafting), while you contribute the 10% that matters (specificity, context, final approval). Generation and publishing are strictly separated — nothing posts without your explicit review.",
    },
    {
      question: "Why doesn't Ozigi fully automate content publishing?",
      answer:
        "Full automation produces forgettable content at scale. The 90/10 split keeps humans in control of what actually matters: adding the specific details only you know, catching errors, and ensuring the content matches your intent. Automation handles the tedious parts; you handle the judgment calls.",
    },
    {
      question: "How does Ozigi prevent accidental publishing?",
      answer:
        "Generation and publishing are architecturally separate in Ozigi. Content moves through explicit stages — draft, review, approved — and requires manual action to publish. There's no 'auto-post' feature by design.",
    },
    {
      question: "What's the 90/10 rule in content creation?",
      answer:
        "The 90/10 rule means AI handles the heavy lifting (organizing inputs, generating structure, drafting content) while humans add the irreplaceable 10%: specific examples, insider knowledge, tone adjustments, and final approval. This produces content that's both efficient to create and authentically human.",
    },
  ],
  "the-structural-audit": [
    {
      question: "What is the Structural Audit in Ozigi?",
      answer:
        "The Structural Audit is a set of seventeen detectors that run over every long-form draft after generation, looking for the AI tells a word blocklist cannot catch: uniform paragraph and sentence lengths, repeated sentence openers, rhetorical questions used as transitions, points restated across sections, and code lead-ins that only narrate what the code shows. It returns a structural score out of 100 with each flag anchored to a specific span.",
    },
    {
      question: "Why isn't a banned word list enough to make AI writing sound human?",
      answer:
        "A model routes around a blocklist by reaching for a synonym — ban 'delve' and it writes 'explore.' The deeper tells are not vocabulary at all, they are properties of the whole document: rhythm, repetition, and structure. Those survive an unlimited blocklist, which is why Ozigi measures them directly instead of adding more rows to a list.",
    },
    {
      question: "How does Ozigi check code samples in generated articles?",
      answer:
        "Every fenced code block is checked for leaked credentials, SQL built by string interpolation, missing language labels, placeholder elisions, and per-language conventions. The highest-value check is the smallest: smart quotes and non-breaking spaces are invisible on the rendered page but cause a syntax error the moment a reader pastes the snippet, so they are treated as errors that block publication.",
    },
    {
      question: "What is audience calibration in long-form generation?",
      answer:
        "Before generating, you pick who the article is for — developer, practitioner, technical writer, beginner, or mixed. Each profile defines jargon level, whether code leads or trails, how much theory belongs, tone, ideal opening, benchmark standards, and analogy use. The same profile is then checked against the finished draft, so a beginner tutorial that assumes fluency or a developer guide with no code gets flagged.",
    },
    {
      question: "Does the structural audit slow down content generation?",
      answer:
        "No. The audit is pure computation with no second model pass and no network calls, and it runs after generation completes. A 2,500-word article takes about 10 milliseconds to audit, against a 60-second request budget where generation itself takes 30 to 55 seconds.",
    },
  ],
};
