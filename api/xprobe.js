// temporary probe — remove after testing
export default async function handler(req, res) {
  try {
    const r = await fetch(
      "https://syndication.twitter.com/srv/timeline-profile/screen-name/0xdioxus",
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        },
      },
    );
    const text = await r.text();
    res.status(200).json({
      status: r.status,
      cors: r.headers.get("access-control-allow-origin"),
      head: text.slice(0, 300),
      length: text.length,
    });
  } catch (e) {
    res.status(200).json({ error: String(e) });
  }
}
