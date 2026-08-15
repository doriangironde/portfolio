const REPO = "doriangironde/message-board";
const PATH = "data/messages.json";
const API = `https://api.github.com/repos/${REPO}/contents/${PATH}`;
const MAX_MESSAGES = 200;
const CACHE_TTL = 20000;

function ghHeaders() {
  return {
    Authorization: `Bearer ${process.env.GITHUB_TOKEN || ""}`,
    "User-Agent": "portfolio",
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

let cache = { messages: null, sha: null, at: 0 };

async function rawRead() {
  const res = await fetch(API, { headers: ghHeaders() });
  if (res.status === 404) return { messages: [], sha: null };
  if (!res.ok) throw new Error(`GitHub read failed: ${res.status}`);
  const data = await res.json();
  let messages = [];
  try {
    messages = JSON.parse(Buffer.from(data.content, "base64").toString("utf8"));
  } catch {}
  if (!Array.isArray(messages)) messages = [];
  return { messages, sha: data.sha };
}

async function readStore(force) {
  if (!force && cache.messages && Date.now() - cache.at < CACHE_TTL) {
    return cache;
  }
  const fresh = await rawRead();
  cache = { messages: fresh.messages, sha: fresh.sha, at: Date.now() };
  return cache;
}

async function writeStore(messages, sha) {
  const body = {
    message: "board update",
    content: Buffer.from(JSON.stringify(messages, null, 1)).toString("base64"),
  };
  if (sha) body.sha = sha;
  const res = await fetch(API, {
    method: "PUT",
    headers: ghHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`GitHub write failed: ${res.status}`);
  cache = { messages, sha: null, at: Date.now() };
}

const recent = new Map();

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const { messages } = await readStore(false);
      const sorted = [...messages].sort((a, b) => b.ts - a.ts);
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({ messages: sorted });
    }

    if (req.method === "POST") {
      const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || "?";
      const now = Date.now();
      const last = recent.get(ip) || 0;
      if (now - last < 8000) {
        return res.status(429).json({ error: "Slow down — one message every few seconds." });
      }

      let text = String(req.body?.text || "").trim().slice(0, 140);
      let author = String(req.body?.author || "").trim().slice(0, 40);
      if (!text) return res.status(400).json({ error: "Message is empty." });
      if (!author) author = "Anonymous";
      text = text.replace(/[<>&]/g, "");
      author = author.replace(/[<>&]/g, "");

      const msg = { id: `${now}-${Math.random().toString(36).slice(2, 8)}`, author, text, ts: now };

      for (let attempt = 0; attempt < 2; attempt++) {
        const { messages, sha } = await readStore(attempt === 0);
        if (messages.length >= MAX_MESSAGES) {
          return res.status(429).json({ error: "Board is full. Try again later." });
        }
        const next = [...messages, msg];
        try {
          await writeStore(next, sha);
          recent.set(ip, now);
          return res.status(201).json({ message: msg });
        } catch (e) {
          cache.at = 0;
          if (attempt === 1) throw e;
        }
      }
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    console.error("messages:", e);
    return res.status(500).json({ error: "Board is having a moment." });
  }
}
