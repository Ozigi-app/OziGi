// GTM sub-pages live inside the dashboard route tree but don't have their own
// sidebar — navigation is handled by GtmPageHeader on each page.
export default function GtmLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
