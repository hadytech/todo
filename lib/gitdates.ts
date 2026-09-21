import { execFileSync } from 'node:child_process'

/**
 * Last commit date per file, for sitemap <lastmod>.
 *
 * A directory is mostly pages that never change. Telling crawlers which
 * few did move is the difference between them re-fetching everything and
 * re-fetching what matters — and crawl budget is the scarce resource for
 * a site whose whole growth plan is search.
 *
 * One `git log` walk builds the whole map; asking per file would be
 * hundreds of processes.
 */
export function lastModifiedByFile(dir: string): Map<string, string> {
  const dates = new Map<string, string>()

  let out: string
  try {
    out = execFileSync(
      'git',
      ['log', '--format=%cI', '--name-only', '--no-merges', '--', dir],
      { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] },
    )
  } catch {
    // No git, or a shallow clone with no history for these paths. Callers
    // omit lastmod rather than invent one — a wrong date is worse than
    // none, because a crawler will trust it.
    return dates
  }

  let current = ''
  for (const line of out.split('\n')) {
    if (!line.trim()) continue
    if (/^\d{4}-\d{2}-\d{2}T/.test(line)) { current = line.trim(); continue }
    // Log order is newest first, so the first date seen for a path wins.
    if (current && !dates.has(line)) dates.set(line, current)
  }

  return dates
}
