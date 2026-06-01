'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, ListChecks, FileText, Mail, Megaphone,
  ListOrdered, Send, UserPlus, Settings, BookOpen,
  ChevronRight,
} from 'lucide-react'

const NAV = [
  {
    group: 'Workspace',
    items: [
      { label: 'Command Center',    icon: LayoutDashboard, href: '/dashboard/gtm' },
      { label: 'Review Queue',      icon: ListChecks,      href: '/dashboard/gtm/review' },
    ],
  },
  {
    group: 'Content Engine',
    items: [
      { label: 'Blog Posts',        icon: FileText,    href: '/dashboard/long-form' },
      { label: 'Newsletters',       icon: Mail,        href: '/dashboard' },
    ],
  },
  {
    group: 'Social Distribution',
    items: [
      { label: 'Campaigns',         icon: Megaphone,   href: '/dashboard' },
      { label: 'Queue',             icon: ListOrdered, href: '/dashboard' },
    ],
  },
  {
    group: 'Outbound Growth',
    items: [
      { label: 'Email Outreach',    icon: Send,        href: '/dashboard/gtm/outreach' },
      { label: 'LinkedIn Outreach', icon: UserPlus,    href: '/dashboard/gtm/linkedin' },
    ],
  },
  {
    group: 'Infrastructure & Settings',
    items: [
      { label: 'Integrations',      icon: Settings,    href: '/dashboard/gtm/settings' },
      { label: 'Brand Voice',       icon: BookOpen,    href: '/dashboard/personas/marketplace' },
    ],
  },
]

export default function GtmSidebar() {
  const pathname = usePathname()

  function isActive(href: string) {
    if (href === '/dashboard/gtm') return pathname === '/dashboard/gtm'
    return pathname.startsWith(href)
  }

  return (
    <aside className="w-60 min-h-screen bg-surface border-r border-border flex flex-col shrink-0">

      {/* Logo */}
      <div className="px-5 py-5 border-b border-border">
        <Link href="/dashboard/gtm" className="flex items-center gap-2.5 no-underline">
          <img src="/logo.png" alt="Ozigi" className="h-8 w-auto logo-spin" />
          <div>
            <div className="text-foreground font-bold text-base leading-none">zigi</div>
            <div className="text-foreground-subtle text-[10px] leading-none mt-0.5 uppercase tracking-widest">GTM Suite</div>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {NAV.map((section) => (
          <div key={section.group} className="mb-5">
            <div className="text-foreground-subtle text-[10px] font-semibold uppercase tracking-widest px-3 mb-1.5">
              {section.group}
            </div>
            {section.items.map((item) => {
              const active = isActive(item.href)
              const Icon = item.icon
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={[
                    'flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-semibold transition-all mb-0.5 no-underline',
                    active
                      ? 'bg-accent/10 text-accent'
                      : 'text-foreground-muted hover:text-foreground hover:bg-surface-2',
                  ].join(' ')}
                >
                  <Icon size={15} className={active ? 'text-accent' : ''} />
                  <span className="flex-1">{item.label}</span>
                  {active && <ChevronRight size={12} className="text-accent/50" />}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-border">
        <Link href="/dashboard" className="flex items-center gap-2 text-foreground-subtle hover:text-accent text-xs transition-colors no-underline">
          <ChevronRight size={12} className="rotate-180" />
          Back to Content Hub
        </Link>
      </div>
    </aside>
  )
}
