// Vercel serverless function — fresh GitHub contribution calendar.
// Includes private contributions (the account has "include private
// contributions" enabled, so restrictedContributionsCount is non-null
// and forces the full calendar to be computed).

const QUERY = `
  query ($login: String!) {
    user(login: $login) {
      contributionsCollection {
        restrictedContributionsCount
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays {
              date
              contributionCount
              weekday
            }
          }
        }
      }
    }
  }
`;

let cache = { data: null, at: 0 };
const CACHE_TTL = 60_000;

export default async function handler(req, res) {
  try {
    if (Date.now() - cache.at < CACHE_TTL && cache.data) {
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json(cache.data);
    }

    const username = process.env.GITHUB_USERNAME || "doriangironde";
    const response = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN || ""}`,
        "Content-Type": "application/json",
        "User-Agent": "doriangironde-site",
      },
      body: JSON.stringify({ query: QUERY, variables: { login: username } }),
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: "GitHub API failed" });
    }

    const payload = await response.json();
    if (payload.errors?.length) {
      return res.status(502).json({ error: payload.errors[0].message });
    }

    const calendar =
      payload.data.user.contributionsCollection.contributionCalendar;

    // assign quartile levels (mirrors src/lib/github-contributions.ts)
    const counts = calendar.weeks
      .flatMap((week) =>
        week.contributionDays.map((day) => day.contributionCount),
      )
      .filter((count) => count > 0)
      .sort((a, b) => a - b);
    const size = counts.length;
    const q1 = size > 0 ? counts[Math.floor(size * 0.25)] : 0;
    const q2 = size > 0 ? counts[Math.floor(size * 0.5)] : 0;
    const q3 = size > 0 ? counts[Math.floor(size * 0.75)] : 0;
    for (const week of calendar.weeks) {
      for (const day of week.contributionDays) {
        if (day.contributionCount === 0) day.level = 0;
        else if (day.contributionCount >= q3) day.level = 4;
        else if (day.contributionCount >= q2) day.level = 3;
        else if (day.contributionCount >= q1) day.level = 2;
        else day.level = 1;
      }
    }

    cache = { data: { calendar }, at: Date.now() };
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ calendar });
  } catch (e) {
    console.error("github-contributions:", e);
    return res.status(500).json({ error: "Could not load contributions" });
  }
}
