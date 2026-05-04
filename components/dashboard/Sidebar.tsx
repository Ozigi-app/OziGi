"use client";
import Link from "next/link";
import StatsWidget from "./StatsWidget";

interface NavItem {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  locked?: boolean;
}

interface SidebarProps {
  isMobileSidebarOpen: boolean;
  setIsMobileSidebarOpen: (open: boolean) => void;
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (collapsed: boolean) => void;
  navItems: NavItem[];
  stats: { campaignsGenerated: number; scheduledCount: number; personasSaved: number };
  planStatus: any;
  isLoadingStats: boolean;
}

export default function Sidebar({
  isMobileSidebarOpen,
  setIsMobileSidebarOpen,
  isSidebarCollapsed,
  setIsSidebarCollapsed,
  navItems,
  stats,
  planStatus,
  isLoadingStats,
}: SidebarProps) {
  return (
    <aside
      className={`
        ${isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full"}
        md:translate-x-0 transition-all duration-300 ease-in-out
        fixed md:relative z-50 h-full bg-surface border-r border-border flex flex-col shadow-2xl md:shadow-none
        ${isSidebarCollapsed ? "w-20" : "w-64 md:w-72"}
      `}
    >
      <div className="p-6 border-b border-border flex justify-between items-center bg-surface">
        {!isSidebarCollapsed ? (
          <>
                        <Link href="/" className="flex items-center gap-2">
          <img src="/logo.png" alt="Ozigi" className="h-8 w-auto logo-spin" />
          
          </Link>
          <Link href="/" className="text-2xl font-black text-brand-navy tracking-tighter">
            Ozigi
          </Link>
          </>
        ) : (
          <img src="/logo.png" alt="Ozigi" className="h-8 w-auto logo-spin" />
        )}
        <button
          className="hidden md:block text-foreground-subtle hover:text-foreground-muted"
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        >
          {isSidebarCollapsed ? "→" : "←"}
        </button>
        <button className="md:hidden text-foreground-subtle" onClick={() => setIsMobileSidebarOpen(false)}>
          ✕
        </button>
      </div>

      <nav className="flex-1 px-2 py-6 space-y-2 overflow-y-auto" data-tour="sidebar-nav">
{navItems.map((item) => {
  let tourId = "";
  switch (item.label) {
    case "Generation History": tourId = "sidebar-history"; break;
    case "Scheduled Posts": tourId = "sidebar-scheduled"; break;
    case "Subscribers": tourId = "sidebar-subscribers"; break;
    case "Personas": tourId = "sidebar-personas"; break;
    case "Persona Marketplace": tourId = "sidebar-personas-marketplace"; break;
    case "Blog Post": tourId = "sidebar-blog-post"; break;
    case "Email Lists": tourId = "sidebar-email-lists"; break;
    case "Settings & Integrations": tourId = "sidebar-settings"; break;
    case "Copilot Settings": tourId = "sidebar-copilot-settings"; break;
  }
  return (
    <button
      key={item.label}
      data-tour={tourId}
      onClick={() => { item.onClick(); setIsMobileSidebarOpen(false); }}
      className={`flex items-center gap-3 w-full px-4 py-3 text-sm font-semibold rounded-xl transition-colors ${isSidebarCollapsed ? 'justify-center' : ''} ${item.locked ? 'text-foreground-subtle hover:bg-bg hover:text-foreground-muted cursor-pointer' : 'text-foreground-muted hover:bg-bg hover:text-accent'}`}
      title={isSidebarCollapsed ? item.label : undefined}
    >
      <span className={isSidebarCollapsed ? 'mx-auto' : ''}>{item.icon}</span>
      {!isSidebarCollapsed && (
        <span className="flex items-center gap-2 flex-1">
          {item.label}
          {item.locked && (
            <span className="ml-auto text-[9px] font-black uppercase tracking-widest text-foreground-subtle bg-surface-2 px-1.5 py-0.5 rounded">
              Org
            </span>
          )}
        </span>
      )}
    </button>
  );
})}
      </nav>

      <StatsWidget
        stats={stats}
        isLoadingStats={isLoadingStats}
        isSidebarCollapsed={isSidebarCollapsed}
        planStatus={planStatus}
      />
    </aside>
  );
}
