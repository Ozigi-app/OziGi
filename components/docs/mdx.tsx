import React from "react";

export const toSlug = (str: string) =>
  str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");

export const extractText = (children: React.ReactNode): string => {
  let text = "";
  React.Children.forEach(children, (child) => {
    if (typeof child === "string") text += child;
    else if (React.isValidElement(child) && (child.props as any).children) {
      text += extractText((child.props as any).children);
    }
  });
  return text;
};

/**
 * Ozigi markdown styling, shared by every docs page.
 *
 * GFM is enabled at the call site (remark-gfm), so tables, strikethrough, and
 * task lists all render — keep the table family below in sync if that changes.
 */
export const mdxComponents = {
  h1: ({ node, children, ...props }: any) => (
    <h1 id={toSlug(extractText(children))} className="scroll-mt-28 text-4xl md:text-5xl font-black italic uppercase tracking-tighter mb-6 text-slate-900" {...props}>{children}</h1>
  ),
  h2: ({ node, children, ...props }: any) => (
    <h2 id={toSlug(extractText(children))} className="scroll-mt-28 text-2xl font-black italic uppercase tracking-tighter text-slate-900 border-b-2 border-slate-100 pb-2 mb-4 mt-14" {...props}>{children}</h2>
  ),
  h3: ({ node, children, ...props }: any) => (
    <h3 id={toSlug(extractText(children))} className="scroll-mt-28 text-xl font-black text-slate-900 mt-9 mb-3" {...props}>{children}</h3>
  ),
  h4: ({ node, children, ...props }: any) => (
    <h4 id={toSlug(extractText(children))} className="scroll-mt-28 text-lg font-bold text-slate-800 mt-6 mb-3" {...props}>{children}</h4>
  ),
  h5: ({ node, children, ...props }: any) => (
    <h5 id={toSlug(extractText(children))} className="scroll-mt-28 text-base font-bold text-slate-800 mt-4 mb-2" {...props}>{children}</h5>
  ),
  h6: ({ node, children, ...props }: any) => (
    <h6 id={toSlug(extractText(children))} className="scroll-mt-28 text-sm font-bold uppercase tracking-widest text-slate-500 mt-4 mb-2" {...props}>{children}</h6>
  ),
  p: ({ node, ...props }: any) => <p className="mb-6 text-slate-700 font-medium leading-relaxed" {...props} />,
  strong: ({ node, ...props }: any) => <strong className="font-black text-slate-900" {...props} />,
  blockquote: ({ node, ...props }: any) => (
    <blockquote className="bg-red-50 border-l-4 border-brand-red p-6 rounded-r-2xl text-slate-800 font-medium my-8 [&>p]:mb-0 [&>p+p]:mt-4" {...props} />
  ),
  pre: ({ node, ...props }: any) => (
    <div className="bg-slate-900 rounded-2xl overflow-hidden shadow-xl my-8 border border-slate-800">
      <div className="bg-slate-800/50 px-4 py-3 flex items-center border-b border-slate-700/50 gap-2">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500/80" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
          <div className="w-3 h-3 rounded-full bg-green-500/80" />
        </div>
        <span className="text-xs font-mono text-slate-400 ml-2">Code Snippet</span>
      </div>
      <pre className="p-6 overflow-x-auto text-sm font-mono text-slate-300 leading-relaxed" {...props} />
    </div>
  ),
  code: ({ node, className, ...props }: any) => {
    if (!className) return <code className="bg-slate-100 text-pink-600 px-1.5 py-0.5 rounded-md font-mono text-sm" {...props} />;
    return <code className={className} {...props} />;
  },
  ul: ({ node, ...props }: any) => <ul className="list-disc pl-6 mb-6 space-y-2 text-slate-700 font-medium leading-relaxed marker:text-brand-red" {...props} />,
  ol: ({ node, ...props }: any) => <ol className="list-decimal pl-6 mb-6 space-y-2 text-slate-700 font-medium leading-relaxed marker:text-brand-red marker:font-black" {...props} />,
  li: ({ node, ...props }: any) => <li className="pl-1" {...props} />,
  a: ({ node, ...props }: any) => (
    <a className="text-brand-red font-bold underline decoration-brand-red/30 underline-offset-2 hover:decoration-brand-red transition-colors" {...props} />
  ),
  hr: ({ node, ...props }: any) => <hr className="my-12 border-t-2 border-slate-100" {...props} />,
  img: ({ node, ...props }: any) => <img className="rounded-2xl border-2 border-slate-200 my-8 w-full" {...props} />,

  // GFM
  table: ({ node, ...props }: any) => (
    <div className="overflow-x-auto my-8 rounded-2xl border-2 border-slate-200">
      <table className="w-full text-left border-collapse text-sm" {...props} />
    </div>
  ),
  thead: ({ node, ...props }: any) => <thead className="bg-slate-900 text-white" {...props} />,
  th: ({ node, ...props }: any) => <th className="px-4 py-3 font-black uppercase tracking-widest text-xs whitespace-nowrap" {...props} />,
  tbody: ({ node, ...props }: any) => <tbody className="divide-y divide-slate-100" {...props} />,
  tr: ({ node, ...props }: any) => <tr className="even:bg-slate-50/60" {...props} />,
  td: ({ node, ...props }: any) => <td className="px-4 py-3 text-slate-700 font-medium align-top" {...props} />,
  del: ({ node, ...props }: any) => <del className="text-slate-400 decoration-brand-red" {...props} />,
};
