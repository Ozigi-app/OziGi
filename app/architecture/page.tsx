"use client";

import React, { useState, useEffect } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";
import Header from "../../components/Header";
import Footer from "../../components/Footer";
import AuthModal from "../../components/AuthModal";
import { supabase } from "@/lib/supabase/client";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

const chartColors = {
  primary:        "rgba(59, 130, 246, 0.85)",
  primaryBorder:  "rgb(37, 99, 235)",
  accent:         "rgba(232, 50, 10, 0.85)",
  accentBorder:   "rgb(200, 30, 0)",
  muted:          "rgba(148, 163, 184, 0.6)",
  mutedBorder:    "rgb(100, 116, 139)",
  green:          "rgba(16, 185, 129, 0.9)",
  greenBorder:    "rgb(5, 150, 105)",
};

const TABS = [
  { id: "overview",   label: "Overview" },
  { id: "gtm",        label: "GTM Pipeline" },
  { id: "stability",  label: "JSON Stability" },
  { id: "image",      label: "Image Pipeline" },
  { id: "lexicon",    label: "Banned Lexicon" },
];

export default function Architecture() {
  const [activeTab, setActiveTab]       = useState("overview");
  const [lexiconOn,  setLexiconOn]      = useState(false);
  const [session,    setSession]        = useState<any>(null);
  const [authOpen,   setAuthOpen]       = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  // ── Charts ──────────────────────────────────────────────────────────────────

  const stabilityData = {
    labels: ["Gemini (responseSchema)", "Claude (Prompted)"],
    datasets: [{
      data: [99.9, 88.5],
      backgroundColor: [chartColors.primary, chartColors.muted],
      hoverOffset: 4,
    }],
  };

  const toneData = {
    labels: [
      lexiconOn ? "Gemini 3.1 Flash (+ Lexicon)" : "Gemini 3.1 Flash (Base)",
      "Claude Sonnet 4 (Base)",
    ],
    datasets: [{
      label: "Quality Score",
      data: [lexiconOn ? 9.2 : 5.5, 9.5],
      backgroundColor: [lexiconOn ? chartColors.green : chartColors.primary, chartColors.muted],
      borderColor:     [lexiconOn ? chartColors.greenBorder : chartColors.primaryBorder, chartColors.mutedBorder],
      borderWidth: 1,
      borderRadius: 6,
    }],
  };

  const scoreDistData = {
    labels: ["0.0–0.3 (dropped)", "0.3–0.6 (review)", "0.6–0.8 (good)", "0.8–1.0 (strong fit)"],
    datasets: [{
      label: "% of sourced leads",
      data: [38, 24, 21, 17],
      backgroundColor: [chartColors.muted, "rgba(249,115,22,0.6)", chartColors.primary, chartColors.green],
      borderColor:     [chartColors.mutedBorder, "rgb(234,88,12)", chartColors.primaryBorder, chartColors.greenBorder],
      borderWidth: 1,
      borderRadius: 6,
    }],
  };

  const barOpts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: { beginAtZero: true, grid: { color: "#f1f5f9" } },
      x: { grid: { display: false } },
    },
  };

  const toneOpts = {
    ...barOpts,
    scales: {
      y: { max: 10, beginAtZero: true, grid: { color: "#f1f5f9" } },
      x: { grid: { display: false } },
    },
    animation: { duration: 600 },
  };

  const scoreOpts = {
    ...barOpts,
    scales: {
      y: { max: 50, beginAtZero: true, grid: { color: "#f1f5f9" }, ticks: { callback: (v: any) => `${v}%` } },
      x: { grid: { display: false } },
    },
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="bg-[#fafafa] font-sans text-slate-900 min-h-screen flex flex-col selection:bg-blue-100 selection:text-blue-900">
      <Header session={session} onSignIn={() => setAuthOpen(true)} />

      <main className="flex-grow max-w-6xl mx-auto w-full px-6 pt-32 pb-16">

        {/* Page header */}
        <div className="mb-12">
          <a href="/" className="text-xs font-bold text-slate-400 hover:text-slate-900 mb-6 inline-block uppercase tracking-widest transition-colors">
            ← Back to Engine
          </a>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
            <div>
              <h1 className="text-4xl md:text-5xl font-black italic uppercase tracking-tighter text-slate-900">
                Ozigi Architecture
              </h1>
              <p className="text-lg font-medium text-slate-500 mt-2">
                Five decisions that shaped the engine.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <span className="px-4 py-1.5 bg-blue-100 text-blue-800 text-xs font-black rounded-full border border-blue-200 uppercase tracking-widest">Gemini 3.1 Flash</span>
              <span className="px-4 py-1.5 bg-slate-100 text-slate-700 text-xs font-black rounded-full border border-slate-200 uppercase tracking-widest">Vertex AI</span>
              <span className="px-4 py-1.5 bg-orange-50 text-orange-800 text-xs font-black rounded-full border border-orange-200 uppercase tracking-widest">Cloudflare R2</span>
            </div>
          </div>
        </div>

        {/* Tab nav */}
        <nav role="tablist" aria-label="Architecture sections" className="flex overflow-x-auto mb-12 gap-2 pb-2 hide-scrollbar border-b border-slate-200/60">
          {TABS.map(t => (
            <button
              key={t.id}
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={activeTab === t.id}
              aria-controls={`panel-${t.id}`}
              tabIndex={activeTab === t.id ? 0 : -1}
              onClick={() => setActiveTab(t.id)}
              className={`px-6 py-3 rounded-t-2xl font-black text-sm whitespace-nowrap uppercase tracking-widest transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#fafafa] ${
                activeTab === t.id ? "bg-slate-900 text-white" : "bg-transparent text-slate-500 hover:bg-slate-100"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {/* ── OVERVIEW ──────────────────────────────────────────────────────── */}
        {activeTab === "overview" && (
          <section id="panel-overview" role="tabpanel" aria-labelledby="tab-overview" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="max-w-3xl bg-white p-8 md:p-12 rounded-[2rem] shadow-sm border border-slate-200">
              <h2 className="text-3xl font-black italic uppercase tracking-tighter mb-6 text-slate-900">
                Five Decisions, One Coherent Product
              </h2>
              <p className="text-lg text-slate-600 leading-relaxed mb-6 font-medium">
                Ozigi is a two-engine product: a content engine and a GTM engine. The five architectural decisions documented here are the ones that determined how both engines behave, what they are built on, and why each choice was made over the obvious alternative.
              </p>
              <p className="text-slate-600 leading-relaxed mb-10">
                The documents are practical, not theoretical. Each tab starts from the constraint that forced the decision, shows the data or reasoning that settled it, and ends with the outcome that is running in production today.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { id: "gtm",       icon: "🎯", title: "GTM Pipeline",    desc: "How leads go from a keyword search to a scored, sequenced outreach." },
                  { id: "stability", icon: "{ }", title: "JSON Stability",  desc: "Why responseSchema is not optional in a multi-platform content engine." },
                  { id: "image",     icon: "🖼️",  title: "Image Pipeline",  desc: "How Gemini 3.1 Flash Image routes to R2 without browser CORS issues." },
                  { id: "lexicon",   icon: "🚫",  title: "Banned Lexicon",  desc: "How a hard blocklist closes the gap between Gemini's tone and Claude's." },
                ].map(c => (
                  <button
                    key={c.id}
                    onClick={() => setActiveTab(c.id)}
                    className="text-left w-full p-6 border border-slate-200 rounded-2xl hover:border-slate-400 hover:shadow-md transition-all cursor-pointer bg-slate-50 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    <div className="text-2xl mb-3 group-hover:scale-110 transition-transform origin-left">{c.icon}</div>
                    <h3 className="font-black uppercase tracking-widest text-slate-900 mb-2 text-sm">{c.title}</h3>
                    <p className="text-sm text-slate-500 font-medium">{c.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ── GTM PIPELINE ──────────────────────────────────────────────────── */}
        {activeTab === "gtm" && (
          <section id="panel-gtm" role="tabpanel" aria-labelledby="tab-gtm" className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
            <div className="max-w-3xl">
              <h2 className="text-3xl font-black italic uppercase tracking-tighter mb-4 text-slate-900">
                GTM Pipeline Architecture
              </h2>
              <p className="text-lg text-slate-600 leading-relaxed font-medium mb-6">
                From a keyword in an ICP field to a scored lead in an outreach sequence — this is the full pipeline.
              </p>
              <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100 text-slate-700">
                <strong>The constraint:</strong> Buying a lead database costs money and returns stale data. The people we need — backend engineers, founding engineers, DevRel — broadcast their role, stack, and problems in public every day on GitHub and Dev.to. The decision was to source from signal, not from a purchased list.
              </div>
            </div>

            {/* Pipeline flow */}
            <div className="bg-white p-8 md:p-12 rounded-[2rem] shadow-sm border border-slate-200">
              <h3 className="text-xl font-black italic uppercase tracking-tighter mb-8 text-slate-900">Pipeline: Source → Score → Sequence</h3>

              <div className="flex flex-col gap-4">
                {[
                  {
                    step: "1", label: "ICP Definition", color: "blue",
                    detail: "Job titles · stack keywords · seniority · location · company stage. Written once, stored on the campaign, reused on every source run.",
                  },
                  {
                    step: "2", label: "Source", color: "blue",
                    detail: "GitHub: bio query (in:bio · language: · location: · type:user). Email recovery from public commit history when the profile hides it. Dev.to: authors under matching tags. LinkedIn: user-session search.",
                  },
                  {
                    step: "3", label: "Score (Gemini)", color: "green",
                    detail: "Each lead's bio, company, and topic tags are sent to Gemini with the ICP. Returns a float 0.0–1.0. Leads below threshold are dropped before entering the sequence.",
                  },
                  {
                    step: "4", label: "Sequence", color: "blue",
                    detail: "Multi-step email + LinkedIn sequence from your own accounts. Per-channel daily limits enforced. Reply detection pauses the sequence on any inbound response.",
                  },
                  {
                    step: "5", label: "CRM Sync", color: "slate",
                    detail: "First-contact write to HubSpot or Zoho via Composio. The CRM stays the pipeline source of truth; Ozigi writes once and stops.",
                  },
                ].map(s => (
                  <div key={s.step} className="flex gap-4 items-start">
                    <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-black text-sm text-white ${
                      s.color === "green" ? "bg-emerald-600" : s.color === "slate" ? "bg-slate-400" : "bg-blue-600"
                    }`}>{s.step}</div>
                    <div className="flex-1 p-4 bg-slate-50 rounded-xl border border-slate-200">
                      <p className="font-black text-sm uppercase tracking-widest text-slate-900 mb-1">{s.label}</p>
                      <p className="text-sm text-slate-600 leading-relaxed">{s.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Score distribution chart */}
            <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200">
              <h3 className="text-xl font-black italic uppercase tracking-tighter mb-2 text-center text-slate-900">ICP Score Distribution</h3>
              <p className="text-xs text-center text-slate-400 mb-8 uppercase tracking-widest font-bold">Typical distribution across a 200-profile GitHub sourcing run</p>
              <div className="h-64 relative w-full">
                <p className="sr-only">Bar chart showing score distribution: 38% of leads score 0–0.3 and are dropped, 24% score 0.3–0.6 for review, 21% score 0.6–0.8 (good fit), 17% score 0.8–1.0 (strong fit).</p>
                <Bar data={scoreDistData} options={scoreOpts} />
              </div>
              <div className="mt-6 text-xs text-slate-500 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <strong className="text-slate-700">Why this matters:</strong> Only the top two bands (0.6–1.0, roughly 38% of the raw list) enter the sequence. Emailing the other 62% would spike bounce and complaint rates without producing replies. The scoring step is what separates a clean sending list from a spam cannon.
              </div>
            </div>
          </section>
        )}

        {/* ── JSON STABILITY ────────────────────────────────────────────────── */}
        {activeTab === "stability" && (
          <section id="panel-stability" role="tabpanel" aria-labelledby="tab-stability" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="mb-12 max-w-3xl">
              <h2 className="text-3xl font-black italic uppercase tracking-tighter mb-4 text-slate-900">
                Bulletproof Structured JSON
              </h2>
              <p className="text-lg text-slate-600 leading-relaxed font-medium mb-6">
                Why natural language capability is secondary to structural predictability in this pipeline.
              </p>
              <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100 text-slate-700">
                <strong>The constraint:</strong> Ozigi&apos;s frontend UI relies entirely on a strictly formatted JSON payload. Gemini&apos;s <code>responseSchema</code> enforces this structure at the API level. Switching to a model that returns JSON via prompt instruction introduces parse failures that break the UI — a hallucinated trailing comma is a user-facing crash.
              </div>
            </div>

            <div className="bg-white p-8 md:p-12 rounded-[2rem] shadow-sm border border-slate-200 flex flex-col items-center">
              <h3 className="text-xl font-black italic uppercase tracking-tighter mb-2 text-center text-slate-900">Format Adherence Rate</h3>
              <p className="text-xs text-center text-slate-400 mb-8 uppercase tracking-widest font-bold">Risk of frontend UI breakage</p>

              <div className="h-64 w-full max-w-sm relative">
                <p className="sr-only">Doughnut chart: Gemini responseSchema 99.9% adherence, Claude prompted 88.5%.</p>
                <Doughnut data={stabilityData} options={{ responsive: true, maintainAspectRatio: false, cutout: "75%", plugins: { legend: { position: "bottom" } } }} />
              </div>

              <div className="mt-8 text-xs text-slate-500 bg-slate-50 p-4 rounded-xl border border-slate-100 w-full max-w-3xl">
                <strong className="text-slate-700">Methodology:</strong> Adherence rate is the percentage of API responses successfully parsed via <code>JSON.parse()</code> without syntax exceptions. N=500 automated test generations targeting the 9-post distribution schema.
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl mt-6">
                <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200">
                  <h4 className="font-black uppercase tracking-widest text-slate-900 mb-4 text-sm border-b border-slate-200 pb-3">The Gemini Approach</h4>
                  <ul className="text-sm text-slate-600 space-y-3 font-medium">
                    <li className="flex gap-2"><span className="text-green-500">✓</span> Strict <code>responseSchema</code> at API level</li>
                    <li className="flex gap-2"><span className="text-green-500">✓</span> Guaranteed valid JSON on every response</li>
                    <li className="flex gap-2"><span className="text-green-500">✓</span> Zero UI crashes from malformed output</li>
                  </ul>
                </div>
                <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200">
                  <h4 className="font-black uppercase tracking-widest text-slate-900 mb-4 text-sm border-b border-slate-200 pb-3">The Prompted-JSON Risk</h4>
                  <ul className="text-sm text-slate-600 space-y-3 font-medium">
                    <li className="flex gap-2"><span className="text-red-400">✗</span> Relies on prompt instructions for structure</li>
                    <li className="flex gap-2"><span className="text-red-400">✗</span> Prone to conversational pre-text or markdown wrapping</li>
                    <li className="flex gap-2"><span className="text-red-400">✗</span> ~11.5% failure rate on the production schema</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── IMAGE PIPELINE ────────────────────────────────────────────────── */}
        {activeTab === "image" && (
          <section id="panel-image" role="tabpanel" aria-labelledby="tab-image" className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
            <div className="max-w-3xl">
              <h2 className="text-3xl font-black italic uppercase tracking-tighter mb-4 text-slate-900">
                Image Generation Pipeline
              </h2>
              <p className="text-lg text-slate-600 leading-relaxed font-medium mb-6">
                How a prompt becomes a CDN-hosted image URL without hitting browser CORS restrictions.
              </p>
              <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100 text-slate-700">
                <strong>The constraint:</strong> The Cloudflare R2 bucket that stores generated images cannot be written to from the browser — the presigned URL approach adds latency and exposes keys. The decision was to upload from the server-side route handler, which has no CORS restrictions, and return only a public CDN URL to the client.
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Current pipeline */}
              <div className="bg-white p-8 md:p-12 rounded-[2rem] shadow-sm border border-slate-200">
                <h3 className="text-xl font-black italic uppercase tracking-tighter mb-8 text-center text-slate-900">
                  Current Architecture
                </h3>
                <div className="flex flex-col items-center space-y-4">
                  {[
                    { label: "Client sends prompt", sub: "text + platform + optional graphic title", color: "slate" },
                    { label: "POST /api/generate-image", sub: "Next.js route handler — server only", color: "blue" },
                    { label: "Gemini 3.1 Flash Image", sub: "via Vertex AI · returns base64 inline data", color: "blue" },
                    { label: "S3Client.send(PutObject)", sub: "direct server → R2 upload · no browser CORS", color: "green" },
                    { label: "Public CDN URL returned", sub: "NEXT_PUBLIC_R2_DOMAIN/assets/generated/…", color: "green" },
                  ].map((node, i) => (
                    <React.Fragment key={i}>
                      <div className={`px-6 py-4 rounded-xl font-black text-sm uppercase tracking-widest shadow-sm w-full text-center border ${
                        node.color === "green" ? "bg-green-50 border-green-200 text-green-800" :
                        node.color === "blue"  ? "bg-blue-50 border-blue-200 text-blue-800" :
                                                  "bg-slate-50 border-slate-200 text-slate-600"
                      }`}>
                        {node.label}
                        <span className="block text-[10px] tracking-normal normal-case font-medium mt-1 opacity-70">{node.sub}</span>
                      </div>
                      {i < 4 && <div className="text-slate-300">↓</div>}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {/* Why not browser-side */}
              <div className="bg-white p-8 md:p-12 rounded-[2rem] shadow-sm border border-slate-200">
                <h3 className="text-xl font-black italic uppercase tracking-tighter mb-6 text-slate-900">Key Decisions</h3>
                <div className="space-y-6">
                  <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200">
                    <p className="font-black text-sm uppercase tracking-widest text-slate-900 mb-2">Gemini 3.1 Flash Image (GA)</p>
                    <p className="text-sm text-slate-600">The stable GA model replaced the <code>-preview</code> variant. The <code>responseModalities: [IMAGE]</code> config returns the image as <code>inlineData</code> (base64) inside the candidate parts array.</p>
                  </div>
                  <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200">
                    <p className="font-black text-sm uppercase tracking-widest text-slate-900 mb-2">Server-Side R2 Upload</p>
                    <p className="text-sm text-slate-600">The base64 payload is converted to a Buffer and written to R2 via <code>@aws-sdk/client-s3</code> from the route handler. The client never touches R2 directly. No presigned URL expiry, no CORS preflight failures.</p>
                  </div>
                  <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200">
                    <p className="font-black text-sm uppercase tracking-widest text-slate-900 mb-2">Two prompt modes</p>
                    <p className="text-sm text-slate-600">If <code>graphicTitle</code> is provided: renders text-forward graphic with headline typography. If empty: generates abstract background matched to the post topic. The distinction is handled entirely in the prompt, not in model config.</p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── BANNED LEXICON ────────────────────────────────────────────────── */}
        {activeTab === "lexicon" && (
          <section id="panel-lexicon" role="tabpanel" aria-labelledby="tab-lexicon" className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
            <div className="max-w-3xl">
              <h2 className="text-3xl font-black italic uppercase tracking-tighter mb-4 text-slate-900">
                The Banned Lexicon
              </h2>
              <p className="text-lg text-slate-600 leading-relaxed font-medium mb-6">
                How engineering constraints close the gap between Gemini&apos;s default tone and output that sounds like a person.
              </p>
              <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100 text-slate-700 mb-6">
                <strong>The constraint:</strong> Gemini&apos;s base output defaults to the statistical average of marketing copy it was trained on. That average opens with "In today&apos;s fast-paced world" and uses "delve", "robust", and "tapestry". The Banned Lexicon is a hard blocklist enforced at the system-prompt level — not a post-processing filter, a generation constraint.
              </div>
              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6">
                <h3 className="font-black italic uppercase tracking-tight text-slate-900 mb-3">Why This Also Matters for LinkedIn</h3>
                <p className="text-slate-700 text-sm leading-relaxed mb-3">
                  LinkedIn&apos;s 360Brew algorithm detects AI-generated content and reduces its distribution. The detection relies on the same vocabulary and structural patterns the Banned Lexicon was designed to eliminate.
                </p>
                <p className="text-slate-700 text-sm leading-relaxed">
                  When Ozigi forbids "leverage", "holistic", and "transformative" at the API level, it&apos;s not just avoiding clichés — it&apos;s removing the exact tokens 360Brew uses as AI-content classifiers. The architectural decision and the algorithm compliance are the same decision.
                </p>
              </div>
            </div>

            <div className="bg-slate-900 text-white p-8 md:p-12 rounded-[2rem] shadow-2xl border-4 border-slate-950 flex flex-col lg:flex-row gap-12 items-center">
              <div className="w-full lg:w-1/3 space-y-8">
                <div>
                  <h3 className="text-xl font-black italic uppercase tracking-tighter text-white mb-2">Constraint Controls</h3>
                  <p className="text-sm text-slate-400 font-medium mb-6">Toggle the Banned Lexicon to see how the constraint changes the quality score.</p>
                  <button
                    onClick={() => setLexiconOn(!lexiconOn)}
                    role="switch"
                    aria-checked={lexiconOn}
                    className={`w-full py-5 px-6 font-black uppercase tracking-widest text-sm rounded-2xl transition-all shadow-xl flex justify-between items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 ${
                      lexiconOn ? "bg-emerald-600 hover:bg-emerald-500 text-white" : "bg-blue-600 hover:bg-blue-500 text-white"
                    }`}
                  >
                    <span>Banned Lexicon</span>
                    <span className={`px-4 py-1.5 rounded-lg text-xs ${lexiconOn ? "bg-emerald-300 text-emerald-900" : "bg-blue-800 text-blue-200"}`}>
                      {lexiconOn ? "ON" : "OFF"}
                    </span>
                  </button>
                </div>

                <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50">
                  <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3">System Prompt:</h4>
                  <p className={`text-sm font-mono italic leading-relaxed transition-colors duration-500 ${lexiconOn ? "text-emerald-400" : "text-slate-400"}`}>
                    {lexiconOn
                      ? `"NEVER use: delve, tapestry, vital, realm, leverage, seamlessly, robust, game-changing, holistic, transformative. Write punchy, pragmatic copy."`
                      : `"Write a professional post based on the context."`}
                  </p>
                </div>
              </div>

              <div className="w-full lg:w-2/3 bg-white rounded-[2rem] p-8">
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 text-center mb-8">Human Cadence Quality Score (1–10)</h3>
                <div className="h-64 relative w-full">
                  <p className="sr-only">Bar chart. Gemini + Banned Lexicon: 9.2. Claude Sonnet 4 base: 9.5. Gemini base: 5.5.</p>
                  <Bar data={toneData} options={toneOpts} />
                </div>
                <div className="mt-6 text-xs text-slate-500 bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <strong className="text-slate-700">Note on subjectivity:</strong> Score is an internal blind A/B benchmark across 50 technical posts, prioritising pragmatic sentence structure and absence of AI-default vocabulary. Not a scientific measurement.
                </div>
              </div>
            </div>
          </section>
        )}

      </main>

      <Footer />
      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}
    </div>
  );
}
