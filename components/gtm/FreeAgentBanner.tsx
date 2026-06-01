'use client'
import { ExternalLink, Code2 } from 'lucide-react'

const REPO_URL = 'https://github.com/Dumebii/free_outbound_agent'

export default function FreeAgentBanner() {
  return (
    <a
      href={REPO_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-3 px-4 py-3 mb-6 rounded-xl border border-border hover:border-border-strong bg-surface hover:bg-surface-2 transition-all duration-200 no-underline"
    >
      <Code2 size={15} className="text-foreground-subtle shrink-0 group-hover:text-foreground transition-colors" />
      <div className="flex-1 min-w-0">
        <span className="text-foreground-muted text-xs">
          <span className="font-semibold text-foreground">Free Outbound Agent</span>
          {' '}— the open-source, low-code version of this. More flexibility, self-hosted, entirely free.
        </span>
      </div>
      <ExternalLink size={12} className="text-foreground-subtle shrink-0 group-hover:text-accent transition-colors" />
    </a>
  )
}
