'use client'
import Link from 'next/link'
import { ListChecks } from 'lucide-react'
import GtmPageHeader from '@/components/gtm/GtmPageHeader'

export default function ReviewQueuePage() {
  return (
    <div>
      <GtmPageHeader title="Review Queue" />
      <div className="px-8 py-7 max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-7">
          <ListChecks size={20} className="text-accent" />
          <div>
            <h1 className="text-2xl font-black text-foreground tracking-tight">Review Queue</h1>
            <p className="text-foreground-subtle text-sm mt-0.5">Content awaiting approval before publishing</p>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-8 text-center">
          <ListChecks size={32} className="text-border mx-auto mb-3" />
          <div className="text-foreground font-semibold mb-1">Unified review queue coming soon</div>
          <p className="text-foreground-subtle text-sm mb-6 max-w-md mx-auto">
            This will consolidate email batch previews, blog post drafts, and scheduled social posts into one approval flow.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link href="/dashboard/gtm" className="text-sm text-accent hover:underline no-underline">
              → Preview campaign emails
            </Link>
            <Link href="/dashboard/long-form" className="text-sm text-accent hover:underline no-underline">
              → Review blog drafts
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
