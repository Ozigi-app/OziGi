'use client';

import Link from "next/link";
import { useState } from "react";
import { motion } from "framer-motion";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

export default function WritePage() {
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const sections = [
    {
      title: "Engineering",
      description: "Technical deep dives, architecture decisions, and how we build.",
      wordCount: "1,500-3,000",
      icon: "⚙️",
    },
    {
      title: "Marketing",
      description: "Growth strategies, go-to-market playbooks, and authentic marketing.",
      wordCount: "1,200-2,500",
      icon: "📈",
    },
    {
      title: "Content",
      description: "Content strategy, copywriting, and the craft of communication.",
      wordCount: "1,000-2,000",
      icon: "✍️",
    },
    {
      title: "Tools Roundup",
      description: "Honest reviews of developer tools, SaaS, and platforms.",
      wordCount: "1,500-2,500",
      icon: "🛠️",
    },
    {
      title: "Ozigi Focus",
      description: "Product updates, roadmap insights, and behind-the-scenes stories.",
      wordCount: "1,000-2,000",
      icon: "💡",
    },
  ];

  const criteria = [
    {
      title: "Original & Authentic",
      description: "Share your genuine insights and experiences. We don't want regurgitated content.",
    },
    {
      title: "Actionable & Deep",
      description: "Go beyond the surface. Provide frameworks, lessons learned, and practical takeaways.",
    },
    {
      title: "Well-Structured",
      description: "Clear writing, good organization, and proper formatting. No walls of text.",
    },
  ];

  const steps = [
    {
      number: "01",
      title: "Apply",
      description: "Fill out the Google Form and tell us your idea. We'll review and get back to you within 48 hours.",
    },
    {
      number: "02",
      title: "Pitch",
      description: "Share a brief outline (200-300 words) of what you plan to write about.",
    },
    {
      number: "03",
      title: "Write",
      description: "Craft your article (1,000-3,000 words depending on section). We provide editorial feedback.",
    },
    {
      number: "04",
      title: "Edit",
      description: "Work with our team to refine, polish, and finalize your piece. We handle SEO & formatting.",
    },
    {
      number: "05",
      title: "Publish",
      description: "Your article goes live on ozigi.app/blog with your bio and links. We promote across all channels.",
    },
  ];

  const faqs = [
    {
      question: "How much do you pay?",
      answer: "We currently do not have the structure to support international payments. However, internet stipends are provided for Nigerian authors. We will be explanding for foreign payment soon!",
    },
    {
      question: "What's the timeline?",
      answer: "Typically 2-3 weeks from approval to publication. It depends on editing needs and your availability.",
    },
    {
      question: "Can I write about my own products?",
      answer: "We allow it if it's genuinely valuable and not just promotional. The article must provide real value to our readers regardless of your product.",
    },
    {
      question: "What if you reject my pitch?",
      answer: "We'll give you honest feedback on why and invite you to pitch again with a different topic. Most rejections are about fit, not quality.",
    },
    {
      question: "Can I republish elsewhere?",
      answer: "Yes, after 30 days exclusive publish on Ozigi. You can republish on your own site or medium after that.",
    },
    {
      question: "Do you edit submitted articles?",
      answer: "We do light editing for clarity and style consistency. We'll run major changes by you first.",
    },
  ];

  return (
    <div className="min-h-screen bg-brand-offwhite">
      {/* Hero Section */}
      <section className="py-16 md:py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <motion.div initial="hidden" animate="visible" variants={fadeUp} className="text-center">
            <span className="inline-block px-3 py-1 bg-brand-red/10 border border-brand-red/30 rounded-full text-xs font-bold text-brand-red uppercase tracking-widest mb-4">
              Contributors welcome
            </span>
            <h1 className="text-5xl md:text-6xl font-black italic uppercase tracking-tighter mb-6 text-brand-navy">
              Write for Ozigi
            </h1>
            <p className="text-xl text-slate-700 mb-8 leading-relaxed">
              Share your expertise with our growing community of developers, marketers, and creators. Get paid, get featured, and reach an engaged audience.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="/writer-guide.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-3 bg-brand-red text-white font-bold uppercase tracking-widest text-sm rounded-lg hover:bg-brand-red/90 transition-colors"
              >
                Download writer guide
              </a>
              <a
                href="https://forms.gle/WPYUSC8EDuuhrtuQ9"
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-3 bg-white border border-slate-200 text-brand-navy font-bold uppercase tracking-widest text-sm rounded-lg hover:border-brand-red hover:text-brand-red transition-colors"
              >
                Submit your pitch
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Sections We Publish */}
      <section className="py-16 md:py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="text-center mb-12"
          >
            <h2 className="text-4xl md:text-5xl text-brand-navy italic uppercase tracking-tighter mb-4">
              What we publish
            </h2>
            <p className="text-lg text-slate-700 max-w-2xl mx-auto">
              Five distinct sections, each with its own focus and audience. Pick one that resonates with your expertise.
            </p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6"
          >
            {sections.map((section, idx) => (
              <motion.div key={idx} variants={fadeUp} className="bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-lg transition-shadow">
                <div className="text-4xl mb-4">{section.icon}</div>
                <h3 className="text-lg text-brand-slate uppercase tracking-tighter mb-2">{section.title}</h3>
                <p className="text-sm text-slate-600 mb-4 line-clamp-3">{section.description}</p>
                <div className="pt-4 border-t border-slate-200">
                  <span className="text-xs font-bold text-brand-red">{section.wordCount} words</span>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* What We Look For */}
      <section className="py-16 md:py-24 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="text-center mb-12"
          >
            <h2 className="text-4xl md:text-5xl text-brand-navy italic uppercase tracking-tighter mb-4">
              What we look for
            </h2>
            <p className="text-lg text-slate-700 max-w-2xl mx-auto">
              Three core principles that make an article a fit for Ozigi.
            </p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
          >
            {criteria.map((criterion, idx) => (
              <motion.div key={idx} variants={fadeUp} className="space-y-4">
                <div className="w-12 h-12 rounded-full bg-brand-red/10 flex items-center justify-center">
                  <span className="text-2xl font-black text-brand-red">{idx + 1}</span>
                </div>
                <h3 className="text-xl text-brand-slate uppercase tracking-tighter">{criterion.title}</h3>
                <p className="text-slate-700 leading-relaxed">{criterion.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-16 md:py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="text-center mb-12"
          >
            <h2 className="text-4xl md:text-5xl text-brand-navy italic uppercase tracking-tighter mb-4">
              How it works
            </h2>
            <p className="text-lg text-slate-700 max-w-2xl mx-auto">
              From pitch to published in 5 steps. We handle the rest.
            </p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="space-y-6"
          >
            {steps.map((step, idx) => (
              <motion.div
                key={idx}
                variants={fadeUp}
                className="flex gap-6 bg-white rounded-2xl border border-slate-200 p-8 hover:shadow-lg transition-shadow"
              >
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-16 w-16 rounded-full bg-brand-red text-white font-black text-xl">
                    {step.number}
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl text-brand-slate uppercase tracking-tighter mb-2">{step.title}</h3>
                  <p className="text-slate-700 leading-relaxed">{step.description}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 md:py-24 px-6 bg-white">
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="text-center mb-12"
          >
            <h2 className="text-4xl md:text-5xl text-brand-navy italic uppercase tracking-tighter mb-4">
              Frequently asked questions
            </h2>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="space-y-4"
          >
            {faqs.map((faq, idx) => (
              <motion.div key={idx} variants={fadeUp} className="border border-slate-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
                  className="w-full text-left p-6 hover:bg-slate-50 transition-colors font-bold uppercase text-brand-navy tracking-tighter flex items-center justify-between"
                >
                  {faq.question}
                  <span className={`text-brand-red text-xl transition-transform ${expandedFaq === idx ? "rotate-180" : ""}`}>
                    +
                  </span>
                </button>
                {expandedFaq === idx && (
                  <div className="px-6 pb-6 text-slate-700 leading-relaxed border-t border-slate-200">
                    {faq.answer}
                  </div>
                )}
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 md:py-24 px-6 bg-gradient-to-r from-brand-red/10 to-brand-red/5">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          className="max-w-3xl mx-auto text-center"
        >
          <h2 className="text-4xl md:text-5xl font-black italic text-brand-navy uppercase tracking-tighter mb-6">
            Ready to share your knowledge?
          </h2>
          <p className="text-lg text-slate-700 mb-8">
            We&apos;re excited to hear your ideas. Submit your pitch below and let&apos;s build something great together.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="/writer-guide.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-8 py-4 bg-brand-red text-white font-bold uppercase tracking-widest rounded-lg hover:bg-brand-red/90 transition-colors"
            >
              Download writer guide
            </a>
            <a
              href="https://forms.gle/WPYUSC8EDuuhrtuQ9"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-8 py-4 bg-white border border-brand-red text-brand-red font-bold uppercase tracking-widest rounded-lg hover:bg-brand-red hover:text-white transition-colors"
            >
              Submit your pitch
            </a>
          </div>
        </motion.div>
      </section>

      {/* Use Ozigi CTA */}
      <section className="py-16 md:py-24 px-6 bg-white">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          className="max-w-3xl mx-auto text-center"
        >
          <h2 className="text-3xl md:text-4xl font-black italic text-brand-navy uppercase tracking-tighter mb-6">
            Write content that sounds like you, not like AI
          </h2>
          <p className="text-lg text-slate-700 mb-8">
            Many of our contributors use Ozigi to turn rough ideas into polished social posts before amplifying their articles. Drop in your draft, your notes, or a link to your piece — Ozigi generates platform-ready content that sounds like you wrote it, not like you asked a chatbot.
          </p>
          <Link
            href="https://ozigi.app/dashboard"
            className="inline-block px-8 py-4 bg-brand-navy text-white font-bold uppercase tracking-widest rounded-lg hover:bg-brand-navy/90 transition-colors"
          >
            Try Ozigi free
          </Link>
        </motion.div>
      </section>
    </div>
  );
}
