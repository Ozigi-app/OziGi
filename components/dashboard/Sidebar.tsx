"use client";
import Link from "next/link";

interface NavItem {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  locked?: boolean;
  sectionLabel?: string;
  subItems?: { label: string; icon: React.ReactNode; onClick: () => void }[];
}

interface SidebarProps {
  isMobileSidebarOpen: boolean;
  setIsMobileSidebarOpen: (open: boolean) => void;
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (collapsed: boolean) => void;
  navItems: NavItem[];
}

const TOUR_IDS: Record<string, string> = {
  "Overview":               "sidebar-overview",
  "Social Posts":           "sidebar-social",
  "Newsletter":             "sidebar-newsletter",
  "Generation History":     "sidebar-history",
  "Scheduled Posts":        "sidebar-scheduled",
  "Subscribers":            "sidebar-subscribers",
  "Personas":               "sidebar-personas",
  "Persona Marketplace":    "sidebar-personas-marketplace",
  "Blog Post":              "sidebar-blog-post",
  "Email Lists":            "sidebar-email-lists",
  "Email Outreach":         "sidebar-email-outreach",
  "LinkedIn Outreach":      "sidebar-linkedin-outreach",
  "Outreach Settings":      "sidebar-outreach-settings",
  "Settings & Integrations":"sidebar-settings",
  "Copilot Settings":       "sidebar-copilot-settings",
};

function NavButton({
  item,
  isSidebarCollapsed,
  onClose,
}: {
  item: NavItem;
  isSidebarCollapsed: boolean;
  onClose: () => void;
}) {
  return (
    <div>
      {item.sectionLabel && (
        <div className={`flex items-center gap-2 px-2 pt-3 pb-1 ${isSidebarCollapsed ? "justify-center" : ""}`}>
          {!isSidebarCollapsed ? (
            <>
              <div className="h-px flex-1 bg-border" />
              <span className="text-[9px] font-black uppercase tracking-widest text-foreground-subtle whitespace-nowrap">
                {item.sectionLabel}
              </span>
              <div className="h-px flex-1 bg-border" />
            </>
          ) : (
            <div className="w-8 h-px bg-border" />
          )}
        </div>
      )}
      <button
        data-tour={TOUR_IDS[item.label]}
        onClick={() => { item.onClick(); onClose(); }}
        className={`flex items-center gap-3 w-full px-3 py-2.5 text-sm font-semibold rounded-xl transition-colors
          ${isSidebarCollapsed ? "justify-center" : ""}
          ${item.locked
            ? "text-foreground-subtle hover:bg-bg hover:text-foreground-muted cursor-pointer"
            : "text-foreground-muted hover:bg-bg hover:text-accent"
          }`}
        title={isSidebarCollapsed ? item.label : undefined}
      >
        <span className={isSidebarCollapsed ? "mx-auto" : ""}>{item.icon}</span>
        {!isSidebarCollapsed && (
          <span className="flex items-center gap-2 flex-1">
            {item.label}
            {item.locked && (
              <span className="ml-auto text-[9px] font-black uppercase tracking-widest text-foreground-subtle bg-surface-2 px-1.5 py-0.5 rounded">
                Growth+
              </span>
            )}
          </span>
        )}
      </button>
      {!isSidebarCollapsed && item.subItems?.map((sub) => (
        <button
          key={sub.label}
          data-tour={TOUR_IDS[sub.label]}
          onClick={() => { sub.onClick(); onClose(); }}
          className="flex items-center gap-2 w-full pl-9 pr-3 py-1.5 text-xs font-medium rounded-xl transition-colors text-foreground-subtle hover:bg-bg hover:text-accent"
        >
          <span className="opacity-60">{sub.icon}</span>
          {sub.label}
        </button>
      ))}
    </div>
  );
}

export default function Sidebar({
  isMobileSidebarOpen,
  setIsMobileSidebarOpen,
  isSidebarCollapsed,
  setIsSidebarCollapsed,
  navItems,
}: SidebarProps) {
  // Split nav into main items and the Settings section (pinned to bottom)
  const settingsIdx = navItems.findIndex((i) => i.sectionLabel === "Settings");
  const mainItems = settingsIdx === -1 ? navItems : navItems.slice(0, settingsIdx);
  const settingsItems = settingsIdx === -1 ? [] : navItems.slice(settingsIdx);

  const closeOnMobile = () => setIsMobileSidebarOpen(false);

  return (
    <aside
      className={`
        ${isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full"}
        md:translate-x-0 transition-all duration-300 ease-in-out
        fixed md:relative z-50 h-full bg-surface border-r border-border flex flex-col shadow-2xl md:shadow-none
        ${isSidebarCollapsed ? "w-20" : "w-64 md:w-72"}
      `}
    >
      {/* Logo header */}
      <div className="px-4 py-4 border-b border-border flex justify-between items-center bg-surface shrink-0">
        {!isSidebarCollapsed ? (
          <>
            <Link href="/" className="flex items-center gap-2">
              <img src="/logo.png" alt="Ozigi" className="h-7 w-auto logo-spin" />
            </Link>
            <Link href="/" className="text-2xl font-black text-brand-navy tracking-tighter">
              Ozigi
            </Link>
          </>
        ) : (
          <img src="/logo.png" alt="Ozigi" className="h-7 w-auto logo-spin" />
        )}
        <button
          className="hidden md:block text-foreground-subtle hover:text-foreground-muted"
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        >
          {isSidebarCollapsed ? "→" : "←"}
        </button>
        <button className="md:hidden text-foreground-subtle" onClick={closeOnMobile}>
          ✕
        </button>
      </div>

      {/* Nav — fills remaining height; scrollbar hidden but functional */}
      <nav
        className="flex-1 px-2 py-4 flex flex-col justify-between overflow-y-auto"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        data-tour="sidebar-nav"
      >
        <style>{`[data-tour="sidebar-nav"]::-webkit-scrollbar{display:none}`}</style>

        {/* Main section */}
        <div className="space-y-0.5">
          {mainItems.map((item) => (
            <NavButton
              key={item.label}
              item={item}
              isSidebarCollapsed={isSidebarCollapsed}
              onClose={closeOnMobile}
            />
          ))}
        </div>

        {/* Settings section — pinned to bottom */}
        <div className="space-y-0.5">
          {settingsItems.map((item) => (
            <NavButton
              key={item.label}
              item={item}
              isSidebarCollapsed={isSidebarCollapsed}
              onClose={closeOnMobile}
            />
          ))}
        </div>
      </nav>
    </aside>
  );
}
