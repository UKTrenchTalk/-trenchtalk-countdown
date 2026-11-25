const GECKO_API = "https://api.geckoterminal.com/api/v2";
const COINGECKO_API = "https://api.coingecko.com/api/v3";
const CACHE_MS = 60_000;
const SEARCH_CACHE_MS = 60_000;
const CATALOGUE_TTL_MS = 24 * 60 * 60 * 1000;
const TIMEOUT_MS = 15_000;
const CATALOGUE_STORAGE_KEY = "trenchtalk_coingecko_coin_catalogue_v1";

const marketCache = new Map();
const searchCache = new Map();
let discoveryCache = [];
let discoveryAt = 0;
let discoveryPromise = null;
let catalogue = null;
let cataloguePromise = null;

async function getJson(url, provider = "market data") {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" }
    });
    if (!response.ok) {
      let detail = "";
      try { detail = (await response.text()).slice(0, 180); } catch {}
      if (response.status === 429) throw new Error(`${provider} rate limit reached. Please wait a moment and try again.`);
      if (response.status === 401 || response.status === 403) throw new Error(`${provider} rejected the request (${response.status}).`);
      throw new Error(`${provider} returned HTTP ${response.status}${detail ? `: ${detail}` : ""}`);
    }
    return await response.json();
  } catch (error) {
    if (error.name === "AbortError") throw new Error(`${provider} request timed out.`);
    throw error;
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

function mapCoinGeckoCoin(coin) {
  return {
    mint: `coingecko:${coin.id}`,
    coinId: coin.id,
    name: coin.name || coin.id,
    symbol: (coin.symbol || "").toUpperCase(),
    nameLower: (coin.name || "").toLowerCase(),
    symbolLower: (coin.symbol || "").toLowerCase(),
    imageUrl: coin.large || coin.thumb || coin.image || null,
    marketCapRank: Number(coin.market_cap_rank) || null,
    protocol: "CoinGecko",
    source: "coingecko",
    market: {
      marketCap: num(coin.market_cap) || null,
      priceUsd: num(coin.current_price) || null,
      volume24h: num(coin.total_volume) || null,
      priceChange24h: num(coin.price_change_percentage_24h) || null,
      pairUrl: `https://www.coingecko.com/en/coins/${coin.id}`,
      imageUrl: coin.large || coin.thumb || coin.image || null
    }
  };
}

async function loadCoinCatalogue() {
  if (catalogue) return catalogue;
  if (cataloguePromise) return cataloguePromise;
  cataloguePromise = (async () => {
    // sessionStorage avoids downloading the full reference list on every page navigation.
    // It is a browser cache only; no token catalogue is written to Firestore.
    try {
      const saved = sessionStorage.getItem(CATALOGUE_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.at && Date.now() - parsed.at < CATALOGUE_TTL_MS && Array.isArray(parsed.coins)) {
          catalogue = parsed.coins;
          return catalogue;
        }
      }
    } catch {}

    const data = await getJson(`${COINGECKO_API}/coins/list?include_platform=false`, "CoinGecko coin catalogue");
    if (!Array.isArray(data)) throw new Error("CoinGecko returned an invalid coin catalogue.");
    catalogue = data.map(coin => ({
      id: coin.id,
      name: coin.name || "",
      symbol: (coin.symbol || "").toUpperCase(),
      nameLower: (coin.name || "").toLowerCase(),
      symbolLower: (coin.symbol || "").toLowerCase()
    }));
    try { sessionStorage.setItem(CATALOGUE_STORAGE_KEY, JSON.stringify({ at: Date.now(), coins: catalogue })); } catch {}
    return catalogue;
  })();
  try { return await cataloguePromise; }
  finally { cataloguePromise = null; }
}

export async function discoverSolanaTokens({ force = false } = {}) {
  if (!force && discoveryCache.length && Date.now() - discoveryAt < CACHE_MS) return discoveryCache;
  if (discoveryPromise) return discoveryPromise;
  discoveryPromise = (async () => {
    const endpoints = [
      `${GECKO_API}/networks/solana/trending_pools?include=base_token,quote_token,dex&page=1&duration=24h`,
      `${GECKO_API}/networks/solana/new_pools?include=base_token,quote_token,dex&page=1`
    ];
    const responses = await Promise.allSettled(endpoints.map(url => getJson(url, "GeckoTerminal discovery")));
    const found = [];
    for (const result of responses) if (result.status === "fulfilled") found.push(...tokensFromPools(result.value));
    const combined = dedupe(found);
    if (combined.length) {
      discoveryCache = combined;
      discoveryAt = Date.now();
    }
    if (!combined.length && responses.every(result => result.status === "rejected")) {
      throw new Error("GeckoTerminal could not load trending or new Solana pools. Its public API may be rate-limited.");
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
  const results = [];
  const failures = [];

  // Search the full CoinGecko reference catalogue locally, not just its top-ranked results.
  try {
    const allCoins = await loadCoinCatalogue();
    const q = key;
    const matches = allCoins.filter(coin =>
      coin.nameLower.includes(q) || coin.symbolLower === q || coin.symbolLower.startsWith(q)
    );
    matches.sort((a, b) => {
      const score = coin => coin.symbolLower === q ? 0 : coin.nameLower === q ? 1 : coin.nameLower.startsWith(q) ? 2 : 3;
      return score(a) - score(b) || a.name.localeCompare(b.name);
    });
    results.push(...matches.slice(0, 35).map(coin => mapCoinGeckoCoin(coin)));
  } catch (error) {
    failures.push(error.message);
  }

  // Fetch rich search results for logos and ranked market metadata.
  const [listedResult, onchainResult] = await Promise.allSettled([
    getJson(`${COINGECKO_API}/search?query=${encoded}`, "CoinGecko search"),
    getJson(`${GECKO_API}/search/pools?query=${encoded}&include=base_token,quote_token,dex,network&page=1`, "GeckoTerminal search")
  ]);

  if (listedResult.status === "fulfilled") {
    const coins = listedResult.value?.coins || [];
    results.push(...coins.slice(0, 30).map(mapCoinGeckoCoin));
  } else failures.push(listedResult.reason?.message || "CoinGecko search failed.");

  if (onchainResult.status === "fulfilled") {
    results.push(...tokensFromPools(onchainResult.value));
  } else failures.push(onchainResult.reason?.message || "GeckoTerminal search failed.");

  const finalResults = dedupe(results).sort((a, b) => {
    const aCG = a.source === "coingecko" ? 0 : 1;
    const bCG = b.source === "coingecko" ? 0 : 1;
    return aCG - bCG || (Number(a.marketCapRank || 999999) - Number(b.marketCapRank || 999999));
  }).slice(0, 60);

  if (!finalResults.length && failures.length >= 2) {
    throw new Error(`Coin search is currently unavailable. ${[...new Set(failures)].join(" ")}`);
  }
  searchCache.set(key, { at: Date.now(), data: finalResults });
  return finalResults;
}

export async function enrichTokens(tokens) {
  if (!Array.isArray(tokens) || !tokens.length) return [];
  const onchain = tokens.filter(t => t?.mint && !String(t.mint).startsWith("coingecko:"));
  if (!onchain.length) return tokens;
  const enriched = await Promise.all(onchain.map(async token => {
    const cached = marketCache.get(token.mint);
    if (cached && Date.now() - cached.at < CACHE_MS) return { ...token, market: cached.data || token.market || null };
    try {
      const pools = await getJson(`${GECKO_API}/networks/solana/tokens/${encodeURIComponent(token.mint)}/pools?page=1`, "GeckoTerminal token details");
      const parsed = tokensFromPools(pools);
      const match = parsed.find(t => t.mint === token.mint);
      const market = match?.market || null;
      marketCache.set(token.mint, { at: Date.now(), data: market });
      return { ...token, imageUrl: token.imageUrl || match?.imageUrl || null, market };
    } catch {
      return { ...token, market: token.market || null };
    }
  }));
  const byMint = new Map(enriched.map(t => [t.mint, t]));
  return tokens.map(t => byMint.get(t.mint) || t);
}

export function clearMarketCache() { marketCache.clear(); }
export function clearDiscoveryCache() { discoveryCache = []; discoveryAt = 0; discoveryPromise = null; }
export default { discoverSolanaTokens, searchAllCoins, enrichTokens, clearMarketCache, clearDiscoveryCache };
