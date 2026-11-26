/**
 * Minimal robots.txt parser/checker: does the applicable User-agent group
 * disallow this path? Not a full spec implementation (no wildcard/$
 * matching), but handles the common case of plain path prefixes — enough
 * for a politeness check before fetching a product page.
 */
export interface RobotsRules {
  disallow: string[];
  allow: string[];
}

export function parseRobotsTxt(text: string, userAgent = '*'): RobotsRules {
  const lines = text.split(/\r?\n/);
  const groups: { agents: string[]; disallow: string[]; allow: string[] }[] = [];
  let current: { agents: string[]; disallow: string[]; allow: string[] } | null = null;

  for (const rawLine of lines) {
    const line = rawLine.split('#')[0]?.trim() ?? '';
    if (!line) continue;
    const [rawKey, ...rest] = line.split(':');
    const key = rawKey?.trim().toLowerCase();
    const value = rest.join(':').trim();
    if (!key) continue;

    if (key === 'user-agent') {
      if (!current || current.disallow.length || current.allow.length) {
        current = { agents: [], disallow: [], allow: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
    } else if (key === 'disallow' && current) {
      if (value) current.disallow.push(value);
    } else if (key === 'allow' && current) {
      if (value) current.allow.push(value);
    }
  }

  const specific = groups.find((g) => g.agents.includes(userAgent.toLowerCase()));
  const wildcard = groups.find((g) => g.agents.includes('*'));
  const chosen = specific ?? wildcard;

  return {
    disallow: chosen?.disallow ?? [],
    allow: chosen?.allow ?? [],
  };
}

export function isPathAllowed(rules: RobotsRules, path: string): boolean {
  const matchingDisallow = rules.disallow
    .filter((rule) => rule === '/' || path.startsWith(rule))
    .sort((a, b) => b.length - a.length)[0];
  const matchingAllow = rules.allow
    .filter((rule) => path.startsWith(rule))
    .sort((a, b) => b.length - a.length)[0];

  if (!matchingDisallow) return true;
  if (matchingAllow && matchingAllow.length >= matchingDisallow.length) return true;
  return false;
}

/**
 * Fetches and checks robots.txt for `url`. Returns true (allowed) if
 * robots.txt is missing/unreachable — most sites don't publish one, and
 * failing open on a 404 is standard crawler behavior — but returns false
 * (not allowed) on any other fetch problem, so a flaky network doesn't
 * silently bypass a real Disallow.
 */
export async function isUrlAllowedByRobots(
  targetUrl: string,
  userAgent: string,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  const target = new URL(targetUrl);
  const robotsUrl = new URL('/robots.txt', target.origin).toString();

  let response: Response;
  try {
    response = await fetchImpl(robotsUrl, { headers: { 'User-Agent': userAgent } });
  } catch {
    return false;
  }

  if (response.status === 404) return true;
  if (!response.ok) return false;

  const text = await response.text();
  const rules = parseRobotsTxt(text, userAgent);
  return isPathAllowed(rules, target.pathname);
}
