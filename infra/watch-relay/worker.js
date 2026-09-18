const TGA_FEEDS = {
  "/tga/safety": "https://tga.gov.au/feeds/alert/safety-alerts.xml",
  "/tga/market-actions": "https://tga.gov.au/feeds/alert/market-actions.xml",
  "/tga/guidance": "https://tga.gov.au/feeds/guidance.xml",
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const upstream = TGA_FEEDS[url.pathname];
    if (!upstream) return new Response("Not found", { status: 404 });
    if (!env.WATCH_RELAY_TOKEN || request.headers.get("Authorization") !== `Bearer ${env.WATCH_RELAY_TOKEN}`) {
      return new Response("Unauthorized", { status: 401 });
    }
    const cache = caches.default;
    const key = new Request(`${url.origin}${url.pathname}`, request);
    const cached = await cache.match(key);
    if (cached) return cached;
    const response = await fetch(upstream, { headers: { Accept: "application/rss+xml, application/xml;q=0.9", "User-Agent": "QARA-Regulatory-Watch/1.0" } });
    if (!response.ok) return new Response(`TGA upstream ${response.status}`, { status: 502 });
    const result = new Response(response.body, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=900, stale-if-error=86400", "X-QARA-Upstream": "TGA" } });
    ctx.waitUntil(cache.put(key, result.clone()));
    return result;
  },
};
