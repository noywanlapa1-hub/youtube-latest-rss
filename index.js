import express from "express";
import axios from "axios";
import { XMLParser } from "fast-xml-parser";

const app = express();
const PORT = process.env.PORT || 3000;

// === your channel (already set to @noypiece) ===
const CHANNEL_ID = "UCbJAB0NNujYXWJvWf2uK4_A";
const RSS_URL = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;

let cache = [];
let lastModified = null;

async function updateRSS() {
  try {
    const headers = {};
    if (lastModified) headers["If-Modified-Since"] = lastModified;

    const res = await axios.get(RSS_URL, { headers, validateStatus: () => true });
    if (res.status === 304) {
      console.log("⏳ No updates (using cache)");
      return;
    }
    if (res.status === 200) {
      const parser = new XMLParser({ ignoreAttributes: false });
      const data = parser.parse(res.data);
      const entries = Array.isArray(data?.feed?.entry)
        ? data.feed.entry
        : data?.feed?.entry
        ? [data.feed.entry]
        : [];
      cache = entries.map((v) => ({
        video_id: v["yt:videoId"],
        title: v.title,
        url: v.link?.["@_href"],
        published_at: v.published,
        thumbnail: v["media:group"]?.["media:thumbnail"]?.["@_url"],
      }));
      lastModified = res.headers["last-modified"];
      console.log("✅ RSS updated:", new Date().toISOString());
    }
  } catch (e) {
    console.error("❌ updateRSS error:", e.message);
  }
}

app.get("/youtube/latest", (req, res) => {
  const limit = Number(req.query.limit) || 10;
  res.json({
    channel_id: CHANNEL_ID,
    updated_at: new Date().toISOString(),
    items: cache.slice(0, limit),
  });
});

app.get("/health", (req, res) => {
  res.json({ ok: true, last_update: lastModified });
});

setInterval(updateRSS, 20 * 60 * 1000); // every 20 minutes
updateRSS();

app.listen(PORT, () => console.log(`🚀 Backend online at port ${PORT}`));
