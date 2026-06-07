"use client";
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-surface border-t border-border text-foreground-muted pt-16 pb-10">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-14">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 bg-surface-2 rounded-xl flex items-center justify-center border border-border">
                <img
                  src="/logo.png"
                  alt="Ozigi Logo"
                  className="h-8 w-auto logo-spin"
                />
              </div>
              <span className="text-lg font-black italic uppercase tracking-tighter text-foreground">
                Ozigi
              </span>
            </div>
            <p className="text-sm text-slate-500 leading-relaxed max-w-xs">
              Find leads, reach out without sounding like a robot, and publish content that sounds like you. Built for small teams who are doing it themselves.
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-widest text-foreground mb-5">
              Features
            </h4>
            <div className="flex flex-col gap-3">
              <Link href="/docs/multimodal-pipeline" className="text-sm text-foreground-subtle hover:text-accent transition-colors">
                Multimodal Ingestion
              </Link>
              <Link href="/docs/the-banned-lexicon" className="text-sm text-foreground-subtle hover:text-accent transition-colors">
                Banned Lexicon
              </Link>
              <Link href="/docs/system-personas" className="text-sm text-foreground-subtle hover:text-accent transition-colors">
                System Personas
              </Link>
              <Link href="/docs/human-in-the-loop" className="text-sm text-foreground-subtle hover:text-accent transition-colors">
                Human‑in‑the‑Loop
              </Link>
            </div>
          </div>

          {/* Community */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-widest text-foreground mb-5">
              Community
            </h4>
            <div className="flex flex-col gap-3">
              <a
                href="https://github.com/Ozigi-app/OziGi/"
                target="_blank"
                rel="noreferrer"
                className="text-sm text-foreground-subtle hover:text-accent transition-colors flex items-center gap-1.5"
              >
                Star us on GitHub
              </a>
              <a href="https://blog.ozigi.app" className="text-sm font-semibold text-foreground-subtle hover:text-accent transition">
                Blog
              </a>
              <Link href="/write" className="text-sm text-foreground-subtle hover:text-accent transition-colors font-semibold">
                Write for Ozigi
              </Link>
              <a
                href="https://linkedin.com/in/dumebi-okolo"
                target="_blank"
                rel="noreferrer"
                className="text-sm text-foreground-subtle hover:text-accent transition-colors"
              >
                LinkedIn
              </a>
            </div>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-widest text-foreground mb-5">
              Connect
            </h4>
            <div className="flex flex-col gap-3">
              <a
                href="mailto:hello@ozigi.app"
                className="text-sm text-foreground-subtle hover:text-accent transition-colors"
              >
                Email Us
              </a>
              <Link href="/demo" className="text-sm text-foreground-subtle hover:text-accent transition-colors">
                Live Demo
              </Link>
              <a
                href={process.env.NEXT_PUBLIC_CALENDLY_URL || "mailto:hello@ozigi.app"}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-foreground-subtle hover:text-accent transition-colors">
                Contact Sales
              </a>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-border pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link href="/privacy-policy" className="text-sm text-foreground-subtle hover:text-accent transition-colors">
            Privacy Policy
          </Link>
          <Link href="/terms" className="text-sm text-foreground-subtle hover:text-accent transition-colors">
            Terms of Service
          </Link>
          <p className="text-xs text-foreground-subtle">
            © 2026 Ozigi. All rights reserved.
          </p>
          <p className="text-xs text-foreground-subtle">
            Built With You In Mind.
          </p>
        </div>
      </div>
    </footer>
  );
}
