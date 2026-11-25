const GECKO_API = "https://api.geckoterminal.com/api/v2";
const COINGECKO_API = "https://api.coingecko.com/api/v3";
const CACHE_MS = 60_000;
const SEARCH_CACHE_MS = 45_000;
const TIMEOUT_MS = 12_000;

const marketCache = new Map();
const searchCache = new Map();
let discoveryCache = [];
let discoveryAt = 0;
let discoveryPromise = null;

async function getJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json;version=20230203" }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status} from ${new URL(url).host}`);
    return response.json();
  } finally {
    clearTimeout(timer);
  }
}

function num(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function tokenIdFromResource(resource) {
  const id = resource?.id || "";
  const attrs = resource?.attributes || {};
  return attrs.address || (id.includes("_") ? id.slice(id.indexOf("_") + 1) : "");
}

function includedTokenMap(json) {
  const map = new Map();
  for (const item of json?.included || []) {
    if (item.type === "token") map.set(item.id, item.attributes || {});
  }
  return map;
}

function tokensFromPools(json) {
  const included = includedTokenMap(json);
  const map = new Map();
  for (const pool of json?.data || []) {
    const rel = pool.relationships || {};
    const attrs = pool.attributes || {};
    for (const side of ["base_token", "quote_token"]) {
      const ref = rel[side]?.data;
      if (!ref) continue;
      const t = included.get(ref.id) || {};
      const address = t.address || tokenIdFromResource({ id: ref.id, attributes: t });
      if (!address) continue;
      const token = {
        mint: address,
        name: t.name || "Unknown Token",
        symbol: t.symbol || "UNKNOWN",
        nameLower: (t.name || "").toLowerCase(),
        symbolLower: (t.symbol || "").toLowerCase(),
        imageUrl: t.image_url || null,
        protocol: "GeckoTerminal",
        pool: attrs.address || null,
        source: "gecko",
        market: {
          priceUsd: num(attrs.base_token_price_usd),
          marketCap: num(t.market_cap_usd || attrs.market_cap_usd) || null,
          fdv: num(attrs.fdv_usd) || null,
          marketCapOrFdv: num(t.market_cap_usd || attrs.market_cap_usd || attrs.fdv_usd) || null,
          liquidity: num(attrs.reserve_in_usd),
          volume24h: num(attrs.volume_usd?.h24),
          volume6h: num(attrs.volume_usd?.h6),
          volume1h: num(attrs.volume_usd?.h1),
          volume5m: num(attrs.volume_usd?.m5),
          priceChange24h: num(attrs.price_change_percentage?.h24),
          priceChange6h: num(attrs.price_change_percentage?.h6),
          priceChange1h: num(attrs.price_change_percentage?.h1),
          pairUrl: attrs.geckoterminal_url || null,
          imageUrl: t.image_url || null,
          updatedAt: Date.now()
        }
      };
      const previous = map.get(address);
      if (!previous || token.market.volume24h > previous.market.volume24h) map.set(address, token);
    }
  }
  return [...map.values()];
}

function dedupe(tokens) {
  const map = new Map();
  for (const token of tokens) {
    if (!token?.mint) continue;
    const old = map.get(token.mint);
    map.set(token.mint, {
      ...old,
      ...token,
      imageUrl: token.imageUrl || old?.imageUrl || null,
      market: token.market || old?.market || null
    });
  }
  return [...map.values()];
}

export async function discoverSolanaTokens({ force = false } = {}) {
  if (!force && discoveryCache.length && Date.now() - discoveryAt < CACHE_MS) return discoveryCache;
  if (discoveryPromise) return discoveryPromise;
  discoveryPromise = (async () => {
    const endpoints = [
      `${GECKO_API}/networks/solana/trending_pools?include=base_token,quote_token,dex&page=1&duration=24h`,
      `${GECKO_API}/networks/solana/new_pools?include=base_token,quote_token,dex&page=1`
    ];
    const responses = await Promise.allSettled(endpoints.map(getJson));
    const found = [];
    for (const result of responses) if (result.status === "fulfilled") found.push(...tokensFromPools(result.value));
    const combined = dedupe(found);
    if (combined.length) {
      discoveryCache = combined;
      discoveryAt = Date.now();
    }
    return combined.length ? combined : discoveryCache;
  })();
  try { return await discoveryPromise; } finally { discoveryPromise = null; }
}

export async function searchAllCoins(term) {
  const query = String(term || "").trim();
  if (query.length < 2) return [];
  const key = query.toLowerCase();
  const cached = searchCache.get(key);
  if (cached && Date.now() - cached.at < SEARCH_CACHE_MS) return cached.data;

  const encoded = encodeURIComponent(query);
  const [listedResult, onchainResult] = await Promise.allSettled([
    getJson(`${COINGECKO_API}/search?query=${encoded}`),
    getJson(`${GECKO_API}/search/pools?query=${encoded}&include=base_token,quote_token,dex,network&page=1`)
  ]);

  const results = [];
  if (listedResult.status === "fulfilled") {
    const coins = listedResult.value?.coins || [];
    for (const coin of coins.slice(0, 20)) {
      results.push({
        mint: `coingecko:${coin.id}`,
        coinId: coin.id,
        name: coin.name,
        symbol: (coin.symbol || "").toUpperCase(),
        nameLower: (coin.name || "").toLowerCase(),
        symbolLower: (coin.symbol || "").toLowerCase(),
        imageUrl: coin.large || coin.thumb || null,
        protocol: "CoinGecko",
        source: "coingecko",
        market: { pairUrl: `https://www.coingecko.com/en/coins/${coin.id}`, imageUrl: coin.large || coin.thumb || null }
      });
    }
  }
  if (onchainResult.status === "fulfilled") results.push(...tokensFromPools(onchainResult.value));

  const finalResults = dedupe(results).slice(0, 40);
  searchCache.set(key, { at: Date.now(), data: finalResults });
  return finalResults;
}

export async function enrichTokens(tokens) {
  if (!Array.isArray(tokens) || !tokens.length) return [];
  const onchain = tokens.filter(t => t?.mint && !String(t.mint).startsWith("coingecko:"));
  if (!onchain.length) return tokens;
  const enriched = await Promise.all(onchain.map(async token => {
    const cached = marketCache.get(token.mint);
    if (cached && Date.now() - cached.at < CACHE_MS) return { ...token, market: cached.data };
    try {
      const pools = await getJson(`${GECKO_API}/networks/solana/tokens/${encodeURIComponent(token.mint)}/pools?page=1`);
      const parsed = tokensFromPools(pools);
      const match = parsed.find(t => t.mint === token.mint);
      const market = match?.market || null;
      marketCache.set(token.mint, { at: Date.now(), data: market });
      return { ...token, imageUrl: token.imageUrl || match?.imageUrl || null, market };
    } catch (error) {
      return { ...token, market: token.market || null };
    }
  }));
  const byMint = new Map(enriched.map(t => [t.mint, t]));
  return tokens.map(t => byMint.get(t.mint) || t);
}

export function clearMarketCache() { marketCache.clear(); }
export function clearDiscoveryCache() { discoveryCache = []; discoveryAt = 0; discoveryPromise = null; }
export default { discoverSolanaTokens, searchAllCoins, enrichTokens, clearMarketCache, clearDiscoveryCache };
