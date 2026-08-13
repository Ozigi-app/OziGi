import Link from "next/link";
import Footer from "../Footer";
import DocsSidebar from "./DocsSidebar";

/**
 * Page frame shared by every /docs route: sticky header, persistent grouped
 * sidebar, content column, and an optional right-hand "on this page" rail.
 */
export default function DocsShell({
  currentSlug,
  toc,
  children,
}: {
  currentSlug: string;
  toc?: { title: string; slug: string; level: number }[];
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[#fafafa] text-slate-900 min-h-screen flex flex-col scroll-smooth">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200 px-4 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center px-4 md:px-8">
          <Link href="/docs" className="flex items-center gap-2">
            <span className="font-black italic uppercase tracking-tighter text-xl text-slate-900">
              Ozigi Docs
            </span>
          </Link>
          <Link
            href="/dashboard"
            className="text-xs font-black uppercase tracking-widest text-slate-500 hover:text-slate-900 transition-colors bg-white border border-slate-200 px-4 py-2 rounded-full shadow-sm"
          >
            Go to Dashboard →
          </Link>
        </div>
      </header>

      <div className="flex-1 max-w-7xl mx-auto w-full px-6 py-12 lg:py-16 flex flex-col lg:flex-row gap-10">
        <DocsSidebar currentSlug={currentSlug} />

        <main className="flex-1 min-w-0 max-w-3xl">{children}</main>

        {toc && toc.length > 1 && (
          <aside className="hidden xl:block w-56 shrink-0">
            <div className="sticky top-28">
              <h3 className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 mb-3">
                On this page
              </h3>
              <ul className="space-y-2 text-sm border-l-2 border-slate-100">
                {toc.map((item) => (
                  <li key={item.slug} className={item.level === 3 ? "pl-6" : "pl-3"}>
                    <a
                      href={`#${item.slug}`}
                      className="text-slate-500 hover:text-brand-red transition-colors block leading-snug"
                    >
                      {item.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        )}
      </div>

      <Footer />
    </div>
  );
}
