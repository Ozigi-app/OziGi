/**
 * LinkedIn people search — finds profiles matching an ICP and saves them
 * as leads directly in Supabase.
 *
 * Called by the /search HTTP endpoint in index.ts when the scrape cron
 * triggers a LinkedIn-source campaign.
 */
import type { BrowserContext } from 'playwright'
import type { SupabaseClient } from '@supabase/supabase-js'

interface IcpConfig {
  job_titles?: string[]
  industries?: string[]
  keywords?: string[]
  locations?: string[]
}

interface FoundProfile {
  url: string
  name: string
  title: string
  location: string
}

function delay(minMs: number, maxMs: number) {
  const ms = Math.floor(Math.random() * (maxMs - minMs) + minMs)
  return new Promise(r => setTimeout(r, ms))
}

/**
 * Builds a LinkedIn people search URL from ICP config.
 * Uses job titles + keywords as the query, location as a filter hint.
 */
function buildSearchUrl(icpConfig: IcpConfig): string {
  const terms = [
    ...(icpConfig.job_titles ?? []).slice(0, 2),
    ...(icpConfig.keywords ?? []).slice(0, 2),
  ].filter(Boolean)

  const query = encodeURIComponent(terms.join(' ') || 'software engineer')
  return `https://www.linkedin.com/search/results/people/?keywords=${query}&origin=GLOBAL_SEARCH_HEADER`
}

/**
 * Scrapes profile cards from the current search results page.
 * LinkedIn's DOM changes frequently — multiple selectors used for robustness.
 */
async function extractProfiles(page: import('playwright').Page): Promise<FoundProfile[]> {
  // Wait for at least one /in/ profile link to appear (or timeout gracefully)
  await page.waitForSelector('a[href*="/in/"]', { timeout: 8_000 }).catch(() => {})

  return page.evaluate(() => {
    const results: FoundProfile[] = []
    const seen = new Set<string>()

    // Walk every /in/ link on the page — DOM-change proof
    const links = Array.from(document.querySelectorAll('a[href*="/in/"]')) as HTMLAnchorElement[]

    for (const linkEl of links) {
      const url = linkEl.href.split('?')[0].split('#')[0]
      if (!url.match(/linkedin\.com\/in\/[^/]+\/?$/)) continue
      if (seen.has(url)) continue
      seen.add(url)

      // Walk up to find the result card container (li or div wrapping the card)
      let card: Element = linkEl
      for (let i = 0; i < 8; i++) {
        if (!card.parentElement) break
        card = card.parentElement
        if (card.tagName === 'LI' || card.classList.length > 0) break
      }

      // Name: prefer aria-hidden span inside the link (LinkedIn hides the real name
      // in a visually-hidden span for screen readers and shows aria-hidden for display)
      const nameSpan = linkEl.querySelector('span[aria-hidden="true"]')
      const name = (nameSpan?.textContent ?? linkEl.textContent ?? '').trim().replace(/\s+/g, ' ')

      // Skip "LinkedIn Member" — anonymised profiles we can't reach
      if (!name || name.toLowerCase().includes('linkedin member')) continue

      // Title: first non-empty text node in a span/div that isn't the name, within the card
      let title = ''
      const textEls = Array.from(card.querySelectorAll('span, div'))
      for (const el of textEls) {
        const t = (el.textContent ?? '').trim().replace(/\s+/g, ' ')
        if (t && t !== name && t.length > 5 && t.length < 150 && !el.querySelector('a')) {
          title = t
          break
        }
      }

      // Skip 1st-degree — already connected
      const cardText = card.textContent ?? ''
      if (cardText.includes('1st') && cardText.includes('degree')) continue

      results.push({ url, name, title, location: '' })
    }

    return results
  })
}

/**
 * Searches LinkedIn for people matching the ICP and saves them as leads.
 * Returns the number of new leads inserted.
 */
export async function searchAndSaveLeads(
  context: BrowserContext,
  supabase: SupabaseClient,
  userId: string,
  campaignId: string,
  icpConfig: IcpConfig,
  limit = 25
): Promise<number> {
  const page = await context.newPage()
  let saved = 0

  try {
    const searchUrl = buildSearchUrl(icpConfig)
    console.log(`[worker:search] searching LinkedIn: ${searchUrl}`)

    await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 30_000 })
    await delay(3000, 5000)

    // Check we're still logged in (not redirected to login page)
    const currentUrl = page.url()
    if (currentUrl.includes('/login') || currentUrl.includes('/checkpoint')) {
      throw new Error('LinkedIn session expired — please reconnect in Settings')
    }

    let profiles: FoundProfile[] = []
    let page_num = 1

    while (profiles.length < limit && page_num <= 3) {
      const found = await extractProfiles(page)
      console.log(`[worker:search] page ${page_num}: found ${found.length} profiles`)
      profiles.push(...found)

      if (profiles.length >= limit || found.length === 0) break

      // Go to next page
      const nextBtn = page.locator('button[aria-label="Next"]').first()
      const hasNext = await nextBtn.isVisible({ timeout: 2_000 }).catch(() => false)
      if (!hasNext) break

      await nextBtn.click()
      await delay(2000, 3500)
      page_num++
    }

    // Deduplicate by URL
    const seen = new Set<string>()
    const unique = profiles.filter(p => {
      if (seen.has(p.url)) return false
      seen.add(p.url)
      return true
    }).slice(0, limit)

    console.log(`[worker:search] ${unique.length} unique profiles to save`)

    // Save as leads
    for (const profile of unique) {
      const profileId = profile.url.match(/\/in\/([^/?#]+)/)?.[1] ?? null

      const { error } = await supabase
        .from('leads')
        .upsert({
          campaign_id:         campaignId,
          user_id:             userId,
          source:              'linkedin',
          source_id:           profileId ?? profile.url,
          name:                profile.name || null,
          email:               null,
          github_username:     null,
          linkedin_url:        profile.url,
          linkedin_profile_id: profileId,
          bio:                 profile.title || null,
          company:             null,
          location:            profile.location || null,
          tags:                [],
          icp_match_score:     null,
          status:              'pending',
        }, { onConflict: 'campaign_id,source,source_id' })

      if (!error) {
        saved++
      } else if (!error.message.includes('duplicate')) {
        console.warn(`[worker:search] save error for ${profile.url}:`, error.message)
      }

      await delay(150, 300)
    }

    console.log(`[worker:search] saved ${saved} new LinkedIn leads`)
  } finally {
    await page.close()
  }

  return saved
}
