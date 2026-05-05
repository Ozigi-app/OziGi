"use client";

import { motion } from "framer-motion";
import { Quote } from "lucide-react";

interface Review {
  name: string;
  initials: string;
  text: string;
  highlight?: string; // key phrase to emphasize
}

const REVIEWS: Review[] = [
  {
    name: "Chukwuka Ikeh",
    initials: "CI",
    text: "I highly recommend, give it a try. Its output feels so humanly. Amazing work to the creator!",
    highlight: "output feels so humanly",
  },
  {
    name: "Henschel Emmanuel",
    initials: "HE",
    text: "The focus on turning raw input into structured, usable content while preserving the user's voice is actually thoughtful. The banned lexicon idea especially stands out. It tackles one of the biggest problems with AI-generated content sounding robotic.",
    highlight: "banned lexicon idea especially stands out",
  },
  {
    name: "Chris Roland",
    initials: "CR",
    text: "This is genuinely useful for anyone who writes regularly. The personalised voice truly makes this a game changer and eliminates the worry generating generic content.",
    highlight: "personalised voice truly makes this a game changer",
  },
  {
    name: "Ganiru Zubie-Okolo",
    initials: "GZ",
    text: "Amazing work. The fact it gives me human like output is great. I highly recommend.",
    highlight: "human like output",
  },
  {
    name: "Olusegun Bobate",
    initials: "OB",
    text: "Great product! It was easy to use and gave a great output that feels human.",
    highlight: "output that feels human",
  },
  {
    name: "Anmol Baranwal",
    initials: "AB",
    text: "Nice. Most content out there feels like AI slop and has no personality.",
    highlight: "AI slop",
  },
  {
    name: "Adaobi Okolo",
    initials: "AO",
    text: "This is very essential for creatives and people that write frequently. You'd be able to do more with less time. I recommend.",
    highlight: "do more with less time",
  },
  {
    name: "Onuselogu Letiscia",
    initials: "OL",
    text: "The output of this is really good. I recommend.",
    highlight: "output of this is really good",
  },
];

// Duplicate for seamless loop
const DOUBLED = [...REVIEWS, ...REVIEWS];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

export default function PeerlistReviews() {
  return (
    <section className="py-20 md:py-28 overflow-hidden">
      <div className="max-w-6xl mx-auto px-8 md:px-14">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={fadeUp}
          className="text-center mb-12"
        >
          <p className="text-[10px] font-black uppercase tracking-[0.22em] mb-4 text-accent">
            From Peerlist Launch
          </p>
          <h2 className="text-3xl md:text-5xl font-black italic uppercase tracking-tighter leading-[0.95] text-foreground">
            Real feedback<br />from real users
          </h2>
          <div className="flex items-center justify-center gap-3 mt-6">
            <div className="flex items-center gap-1">
              {[...Array(5)].map((_, i) => (
                <svg key={i} className="w-5 h-5 text-orange-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>
            <span className="text-sm font-bold text-foreground-muted">
              5.0 Idea / 4.9 Execution / 4.4 Design
            </span>
          </div>
        </motion.div>
      </div>

      {/* Scrolling marquee */}
      <div className="relative w-full overflow-hidden">
        {/* Fade edges — use CSS var for bg */}
        <div
          className="pointer-events-none absolute left-0 top-0 bottom-0 w-24 z-10"
          style={{ background: "linear-gradient(to right, var(--bg), transparent)" }}
        />
        <div
          className="pointer-events-none absolute right-0 top-0 bottom-0 w-24 z-10"
          style={{ background: "linear-gradient(to left, var(--bg), transparent)" }}
        />

        <div
          className="flex items-stretch gap-5 animate-scroll whitespace-nowrap"
          style={{ animationDuration: "35s" }}
        >
          {DOUBLED.map((review, i) => (
            <ReviewCard key={`${review.name}-${i}`} review={review} />
          ))}
        </div>
      </div>

      {/* Peerlist badge link */}
      <div className="flex justify-center mt-10">
        <a
          href="https://peerlist.io/dumebi/project/ai-content-generator-that-sounds-human"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border text-foreground-muted hover:text-accent hover:border-accent transition-colors text-xs font-bold uppercase tracking-widest"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
          </svg>
          View all 37 reviews on Peerlist
        </a>
      </div>
    </section>
  );
}

function ReviewCard({ review }: { review: Review }) {
  // Highlight the key phrase if present
  const highlightText = (text: string, highlight?: string) => {
    if (!highlight) return text;
    const parts = text.split(new RegExp(`(${highlight})`, "gi"));
    return parts.map((part, i) =>
      part.toLowerCase() === highlight.toLowerCase() ? (
        <span key={i} className="text-accent font-bold">
          {part}
        </span>
      ) : (
        part
      )
    );
  };

  return (
    <div className="flex-shrink-0 w-[340px] md:w-[400px] p-6 rounded-2xl border border-border bg-surface shadow-sm whitespace-normal">
      <Quote className="w-6 h-6 text-accent mb-3 opacity-60" />
      <p className="text-sm md:text-base text-foreground-muted leading-relaxed mb-5">
        &ldquo;{highlightText(review.text, review.highlight)}&rdquo;
      </p>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent to-[#ff6b4a] flex items-center justify-center">
          <span className="text-xs font-black text-white">{review.initials}</span>
        </div>
        <div>
          <p className="text-sm font-bold text-foreground">{review.name}</p>
          <p className="text-xs text-foreground-subtle">Peerlist reviewer</p>
        </div>
      </div>
    </div>
  );
}
