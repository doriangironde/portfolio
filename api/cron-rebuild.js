export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const teamId = process.env.VERCEL_TEAM_ID;
  const token = process.env.VERCEL_TOKEN;
  if (!teamId || !token) {
    return res.status(500).json({ error: "missing env" });
  }

  try {
    const deployment = await fetch(
      `https://api.vercel.com/v13/deployments?teamId=${teamId}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "siteperso",
          gitSource: {
            type: "github",
            repoId: 1334463152,
            ref: "main",
          },
        }),
      },
    );
    const payload = await deployment.json();
    if (!deployment.ok) {
      return res.status(deployment.status).json({ error: payload });
    }
    return res.status(200).json({ deployment: payload.url || payload.id });
  } catch (e) {
    console.error("cron-rebuild:", e);
    return res.status(500).json({ error: String(e) });
  }
}
