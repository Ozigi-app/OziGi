'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Send, UserPlus, Settings, ListChecks, ChevronRight } from 'lucide-react'

const NAV = [
  { label: 'Overview',         href: '/dashboard',              icon: LayoutDashboard },
  { label: 'Email Outreach',   href: '/dashboard/gtm/outreach', icon: Send            },
  { label: 'LinkedIn',         href: '/dashboard/gtm/linkedin', icon: UserPlus        },
  { label: 'Review Queue',     href: '/dashboard/gtm/review',   icon: ListChecks      },
  { label: 'Settings',         href: '/dashboard/gtm/settings', icon: Settings        },
]

export default function GtmPageHeader({ title }: { title: string }) {
  const pathname = usePathname()

  return (
    <div className="bg-surface border-b border-border sticky top-0 z-10">
      {/* Breadcrumb row */}
      <div className="px-6 py-3 flex items-center gap-2 text-sm border-b border-border/50">
        <Link href="/dashboard" className="text-foreground-subtle hover:text-accent transition-colors no-underline font-medium">
          Dashboard
        </Link>
        <ChevronRight size={13} className="text-foreground-subtle" />
        <span className="text-foreground font-semibold">{title}</span>
      </div>

      {/* GTM sub-nav */}
      <div className="px-6 flex items-center gap-1 overflow-x-auto">
        {NAV.map(item => {
          const active = item.href === '/dashboard'
            ? pathname === '/dashboard'
            : pathname.startsWith(item.href)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                'flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold whitespace-nowrap transition-colors no-underline border-b-2 -mb-px',
                active
                  ? 'text-accent border-accent'
                  : 'text-foreground-muted hover:text-foreground border-transparent',
              ].join(' ')}
            >
              <Icon size={13} />
              {item.label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
