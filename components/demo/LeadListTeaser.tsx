"use client";
import { motion } from "framer-motion";
import { Lock, Users } from "lucide-react";

const EMAIL_LEADS = [
  { name: "Sarah Chen",       title: "Head of Growth",    company: "Stackflow",      email: "s.chen@stackflow.io",       status: "Not contacted" },
  { name: "Marcus Webb",      title: "VP of Sales",       company: "Crestline AI",   email: "m.webb@crestlineai.com",    status: "Not contacted" },
  { name: "Priya Nair",       title: "Founder & CEO",     company: "Launchpad HQ",   email: "p.nair@launchpadhq.co",     status: "Not contacted" },
  { name: "Tom Okafor",       title: "Director of Biz Dev","company": "Nodewell",    email: "t.okafor@nodewell.io",      status: "Not contacted" },
  { name: "Elena Vasquez",    title: "Chief Revenue Officer","company": "Driftmark",  email: "e.vasquez@driftmark.com",  status: "Not contacted" },
  { name: "David Kim",        title: "Co-Founder",        company: "Folio Labs",     email: "d.kim@foliolabs.com",       status: "Not contacted" },
  { name: "Aisha Okonkwo",    title: "Head of Partnerships","company": "Meridian SaaS","email": "a.okonkwo@meridiansaas.com","status": "Not contacted" },
  { name: "James Thornton",   title: "GTM Lead",          company: "Apex Ventures",  email: "j.thornton@apexvc.io",      status: "Not contacted" },
];

const LINKEDIN_LEADS = [
  { name: "Sarah Chen",       title: "Head of Growth",      company: "Stackflow",       url: "linkedin.com/in/sarahchen-growth",    connected: false },
  { name: "Marcus Webb",      title: "VP of Sales",         company: "Crestline AI",    url: "linkedin.com/in/marcuswebb",         connected: false },
  { name: "Priya Nair",       title: "Founder & CEO",       company: "Launchpad HQ",    url: "linkedin.com/in/priyanair-founder",  connected: false },
  { name: "Tom Okafor",       title: "Director of Biz Dev", company: "Nodewell",        url: "linkedin.com/in/tomokafor",          connected: false },
  { name: "Elena Vasquez",    title: "Chief Revenue Officer","company": "Driftmark",     url: "linkedin.com/in/elenavasquez",      connected: false },
  { name: "David Kim",        title: "Co-Founder",          company: "Folio Labs",      url: "linkedin.com/in/davidkim-folio",    connected: false },
  { name: "Aisha Okonkwo",    title: "Head of Partnerships","company": "Meridian SaaS", url: "linkedin.com/in/aishaokonkwo",      connected: false },
  { name: "James Thornton",   title: "GTM Lead",            company: "Apex Ventures",   url: "linkedin.com/in/jamesthornton-gtm", connected: false },
];

function Avatar({ name }: { name: string }) {
  const initials = name.split(" ").map(n => n[0]).join("").slice(0, 2);
  const colors = ["bg-violet-100 text-violet-700","bg-blue-100 text-blue-700","bg-emerald-100 text-emerald-700","bg-amber-100 text-amber-700","bg-pink-100 text-pink-700","bg-cyan-100 text-cyan-700"];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${color}`}>
      {initials}
    </div>
  );
}

export function LeadListTeaser({
  type,
  onSignUp,
  isAuthenticated,
}: {
  type: "email" | "linkedin";
  onSignUp: () => void;
  isAuthenticated: boolean;
}) {
  const leads = type === "email" ? EMAIL_LEADS : LINKEDIN_LEADS;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="mt-8"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-bold text-slate-700">
            Your automated pipeline
          </span>
        </div>
        <div className="flex-1 h-px bg-slate-200" />
        <span className="text-xs text-slate-400 font-medium">
          {leads.length} leads matched
        </span>
      </div>

      <div className="relative rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        {/* Table header */}
        <div className="grid grid-cols-12 gap-3 px-4 py-2.5 bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-widest">
          <div className="col-span-4">Name</div>
          <div className="col-span-4">{type === "email" ? "Email" : "LinkedIn"}</div>
          <div className="col-span-4">Company</div>
        </div>

        {/* Rows — blurred */}
        <div className="divide-y divide-slate-100 select-none" style={{ filter: "blur(3.5px)", pointerEvents: "none" }}>
          {leads.map((lead, i) => (
            <div key={i} className="grid grid-cols-12 gap-3 px-4 py-3 items-center">
              <div className="col-span-4 flex items-center gap-2.5">
                <Avatar name={lead.name} />
                <div>
                  <p className="text-sm font-semibold text-slate-800 leading-tight">{lead.name}</p>
                  <p className="text-xs text-slate-400">{lead.title}</p>
                </div>
              </div>
              <div className="col-span-4">
                <p className="text-sm text-slate-600 font-mono truncate">
                  {"email" in lead ? lead.email : lead.url}
                </p>
              </div>
              <div className="col-span-4 flex items-center justify-between">
                <p className="text-sm text-slate-600">{lead.company}</p>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                  {"status" in lead ? lead.status : "Not connected"}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Gradient + CTA overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-white/10 via-white/70 to-white/95">
          <div className="text-center px-6 mt-24">
            <div className="w-12 h-12 bg-[#0A1628] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Lock className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-[#0A1628] font-black italic uppercase tracking-tighter text-2xl mb-2 leading-tight">
              {isAuthenticated
                ? "Your real pipeline awaits."
                : "Sign up to fill your pipeline."}
            </h3>
            <p className="text-slate-500 text-sm mb-6 max-w-sm mx-auto leading-relaxed">
              {isAuthenticated
                ? "Head to the GTM dashboard to build and automate a real lead list for this exact target."
                : `Ozigi finds ${type === "email" ? "verified emails" : "LinkedIn profiles"} matching your target, writes personalised messages, and sends them automatically — while you sleep.`}
            </p>
            <button
              onClick={onSignUp}
              className="bg-[#E8320A] hover:bg-[#C5280A] text-white font-black uppercase tracking-widest text-sm px-8 py-4 rounded-xl transition-all active:scale-[0.98] shadow-lg"
            >
              {isAuthenticated ? "Go to GTM Dashboard →" : "Unlock My Pipeline →"}
            </button>
            {!isAuthenticated && (
              <p className="text-slate-400 text-xs mt-3">Free to start · No credit card</p>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
