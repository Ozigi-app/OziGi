import { redirect } from 'next/navigation'

// The GTM Command Center has been merged into the main dashboard overview.
export default function GtmIndexPage() {
  redirect('/dashboard')
}
