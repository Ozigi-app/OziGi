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
  return page.evaluate(() => {
    const results: FoundProfile[] = []

    // LinkedIn uses different container classes across versions
    const cards = document.querySelectorAll(
      'li.reusable-search__result-container, .entity-result__item, .search-result'
    )

    cards.forEach(card => {
      // Profile link — must contain /in/
      const linkEl = card.querySelector('a[href*="/in/"]') as HTMLAnchorElement | null
      if (!linkEl) return

      const url = linkEl.href.split('?')[0].split('#')[0]
      if (!url.includes('/in/')) return

      // Name — try several selectors
      const name = (
        card.querySelector('.entity-result__title-text a span[aria-hidden="true"]')?.textContent ??
        card.querySelector('.entity-result__title-text')?.textContent ??
        card.querySelector('[data-anonymize="person-name"]')?.textContent ??
        ''
      ).trim().replace(/\s+/g, ' ')

      // Title / headline
      const title = (
        card.querySelector('.entity-result__primary-subtitle')?.textContent ??
        card.querySelector('.subline-level-1')?.textContent ??
        ''
      ).trim().replace(/\s+/g, ' ')

      // Location
      const location = (
        card.querySelector('.entity-result__secondary-subtitle')?.textContent ??
        card.querySelector('.subline-level-2')?.textContent ??
        ''
      ).trim().replace(/\s+/g, ' ')

      // Skip 1st-degree connections — already connected
      const degree = card.querySelector('.entity-result__badge-text, .dist-value')?.textContent ?? ''
      if (degree.includes('1st')) return

      if (url && name) {
        results.push({ url, name, title, location })
      }
    })

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

    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 20_000 })
    await delay(2500, 4000)

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
