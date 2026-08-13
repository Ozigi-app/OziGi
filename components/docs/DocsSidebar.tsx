"use client";

import Link from "next/link";
import { useState } from "react";
import { groupedNav, hrefFor } from "@/lib/docs-nav";

/**
 * Persistent docs navigation. Renders as a sticky rail on desktop and a
 * collapsible drawer under the header on mobile, from the same config so the
 * two can never disagree.
 */
export default function DocsSidebar({ currentSlug }: { currentSlug: string }) {
  const [open, setOpen] = useState(false);
  const groups = groupedNav();

  const nav = (
    <nav className="space-y-7">
      {groups.map(({ group, pages }) => (
        <div key={group}>
          <h3 className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 mb-2.5 px-3">
            {group}
          </h3>
          <ul className="space-y-0.5">
            {pages.map((page) => {
              const active = page.slug === currentSlug;
              return (
                <li key={page.slug || "index"}>
                  <Link
                    href={hrefFor(page)}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      active
                        ? "bg-brand-red/10 text-brand-red font-bold"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-medium"
                    }`}
                  >
                    {page.icon && <span aria-hidden="true">{page.icon}</span>}
                    {page.nav}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <>
      {/* Mobile toggle */}
      <div className="lg:hidden mb-6">
        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="docs-mobile-nav"
          className="w-full flex items-center justify-between bg-white border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700"
        >
          <span>Browse documentation</span>
          <span aria-hidden="true" className={`transition-transform ${open ? "rotate-180" : ""}`}>
            ▾
          </span>
        </button>
        {open && (
          <div id="docs-mobile-nav" className="mt-3 bg-white border-2 border-slate-200 rounded-xl p-4">
            {nav}
          </div>
        )}
      </div>

      {/* Desktop rail */}
      <aside className="hidden lg:block w-64 shrink-0">
        <div className="sticky top-28 max-h-[calc(100vh-8rem)] overflow-y-auto pr-2 pb-8">{nav}</div>
      </aside>
    </>
  );
}
