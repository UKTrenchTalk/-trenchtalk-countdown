const DEXSCREENER_API = "https://api.dexscreener.com";
const GECKOTERMINAL_API = "https://api.geckoterminal.com/api/v2";

const MARKET_CACHE_DURATION = 60_000;
const EMPTY_CACHE_DURATION = 15_000;
const METADATA_CACHE_DURATION = 60 * 60 * 1000;
const DISCOVERY_CACHE_DURATION = 120_000;

const BATCH_SIZE = 30;
const MAX_CONCURRENT_REQUESTS = 3;
const REQUEST_TIMEOUT = 10_000;

const marketCache = new Map();
const metadataCache = new Map();

let discoveryCache = [];
let discoveryUpdatedAt = 0;
let discoveryPromise = null;

function toHttpUri(uri) {
  if (!uri || typeof uri !== "string") return null;

  const value = uri.trim();

  if (value.startsWith("ipfs://")) {
    const path = value.slice(7).replace(/^ipfs\//, "");
    return `https://ipfs.io/ipfs/${path}`;
  }

  if (value.startsWith("ar://")) {
    return `https://arweave.net/${value.slice(5)}`;
  }

  if (value.startsWith("https://") || value.startsWith("http://")) {
    return value;
  }

  return null;
}

async function fetchWithTimeout(url) {
  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT
  );

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchTokenMetadata(uri) {
  const url = toHttpUri(uri);

  if (!url) return null;

  const cached = metadataCache.get(url);

  if (
    cached &&
    Date.now() - cached.updatedAt < METADATA_CACHE_DURATION
  ) {
    return cached.data;
  }

  try {
    const response = await fetchWithTimeout(url);
    const json = await response.json();

    const data = {
      imageUrl: toHttpUri(
        json.image ||
        json.image_url ||
        json.logoURI ||
        json.logo ||
        ""
      ),
      name: json.name || null,
      symbol: json.symbol || null,
      description: json.description || null
    };

    metadataCache.set(url, {
      data,
      updatedAt: Date.now()
    });

    return data;
  } catch (error) {
    console.warn(
      "[Metadata] Metadata unavailable:",
      error.message
    );

    metadataCache.set(url, {
      data: null,
      updatedAt: Date.now() - METADATA_CACHE_DURATION + 60_000
    });

    return null;
  }
}

function getBestPair(pairs, mint) {
  if (!Array.isArray(pairs)) return null;

  const target = mint.toLowerCase();

  const matching = pairs.filter((pair) => {
    const base = pair.baseToken?.address?.toLowerCase();
    const quote = pair.quoteToken?.address?.toLowerCase();

    return base === target || quote === target;
  });

  if (!matching.length) return null;

  return matching.sort((a, b) => {
    const volumeDifference =
      (Number(b.volume?.h24) || 0) -
      (Number(a.volume?.h24) || 0);

    if (volumeDifference !== 0) return volumeDifference;

    return (
      (Number(b.liquidity?.usd) || 0) -
      (Number(a.liquidity?.usd) || 0)
    );
  })[0];
}

function normaliseMarketData(pair, mint) {
  if (!pair) return null;

  const isBase =
    pair.baseToken?.address?.toLowerCase() === mint.toLowerCase();

  const token = isBase
    ? pair.baseToken
    : pair.quoteToken;

  const rawMarketCap =
    pair.marketCap !== undefined && pair.marketCap !== null
      ? Number(pair.marketCap)
      : null;

  const fdv =
    pair.fdv !== undefined && pair.fdv !== null
      ? Number(pair.fdv)
      : null;

  return {
    priceUsd: Number(pair.priceUsd) || null,

    marketCap: rawMarketCap,
    fdv,

    marketCapOrFdv: rawMarketCap ?? fdv,

    marketCapIsFdv:
      rawMarketCap === null && fdv !== null,

    liquidity: Number(pair.liquidity?.usd) || 0,

    volume24h: Number(pair.volume?.h24) || 0,
    volume6h: Number(pair.volume?.h6) || 0,
    volume1h: Number(pair.volume?.h1) || 0,
    volume5m: Number(pair.volume?.m5) || 0,

    priceChange5m: Number(pair.priceChange?.m5) || 0,
    priceChange1h: Number(pair.priceChange?.h1) || 0,
    priceChange6h: Number(pair.priceChange?.h6) || 0,
    priceChange24h: Number(pair.priceChange?.h24) || 0,

    buys24h: Number(pair.txns?.h24?.buys) || 0,
    sells24h: Number(pair.txns?.h24?.sells) || 0,

    buys1h: Number(pair.txns?.h1?.buys) || 0,
    sells1h: Number(pair.txns?.h1?.sells) || 0,

    buys5m: Number(pair.txns?.m5?.buys) || 0,
    sells5m: Number(pair.txns?.m5?.sells) || 0,

    imageUrl: pair.info?.imageUrl || null,

    pairAddress: pair.pairAddress || null,
    dexId: pair.dexId || null,
    pairUrl: pair.url || null,

    tokenName: token?.name || null,
    tokenSymbol: token?.symbol || null,

    pairCreatedAt: pair.pairCreatedAt || null,

    updatedAt: Date.now()
  };
}

async function fetchTokenBatch(mints) {
  const url =
    `${DEXSCREENER_API}/tokens/v1/solana/${mints.join(",")}`;

  const response = await fetchWithTimeout(url);
  const data = await response.json();

  return Array.isArray(data) ? data : [];
}

async function processBatches(batches) {
  const results = new Map();

  let nextBatch = 0;

  async function worker() {
    while (nextBatch < batches.length) {
      const index = nextBatch++;
      const batch = batches[index];

      try {
        const pairs = await fetchTokenBatch(
          batch.map((token) => token.mint)
        );

        for (const token of batch) {
          const pair = getBestPair(pairs, token.mint);

          const market = normaliseMarketData(
            pair,
            token.mint
          );

          results.set(token.mint, market);

          marketCache.set(token.mint, {
            data: market,
            updatedAt: Date.now()
          });
        }
      } catch (error) {
        console.error(
          "[DexScreener] Batch failed:",
          error.message
        );

        for (const token of batch) {
          results.set(token.mint, undefined);
        }
      }
    }
  }

  const workers = Array.from(
    {
      length: Math.min(
        MAX_CONCURRENT_REQUESTS,
        batches.length
      )
    },
    () => worker()
  );

  await Promise.all(workers);

  return results;
}

// --------------------------------------------------
// TOKEN DISCOVERY
// --------------------------------------------------

function normaliseDiscoveredToken(raw) {
  if (!raw?.mint) return null;

  return {
    mint: raw.mint,

    name: raw.name || "Unknown Token",
    symbol: raw.symbol || "UNKNOWN",

    nameLower: (raw.name || "Unknown Token").toLowerCase(),
    symbolLower: (raw.symbol || "UNKNOWN").toLowerCase(),

    imageUrl: raw.imageUrl || null,

    protocol: raw.protocol || "Solana",

    pool: raw.pool || null,

    uri: raw.uri || null,

    source: "discovery"
  };
}

function extractGeckoTokens(json) {
  const tokens = [];

  const included = new Map();

  for (const item of json?.included || []) {
    if (item.type === "token") {
      included.set(item.id, item.attributes || {});
    }
  }

  for (const pool of json?.data || []) {
    const attributes = pool.attributes || {};
    const relationships = pool.relationships || {};

    const baseId = relationships.base_token?.data?.id;
    const quoteId = relationships.quote_token?.data?.id;

    const base = included.get(baseId);
    const quote = included.get(quoteId);

    const baseMint =
      base?.address ||
      (baseId?.startsWith("solana_")
        ? baseId.slice(7)
        : null);

    const quoteMint =
      quote?.address ||
      (quoteId?.startsWith("solana_")
        ? quoteId.slice(7)
        : null);

    if (baseMint) {
      tokens.push({
        mint: baseMint,
        name: base?.name || null,
        symbol: base?.symbol || null,
        imageUrl: base?.image_url || null,
        pool: attributes.address || null,
        protocol: "GeckoTerminal"
      });
    }

    if (quoteMint) {
      tokens.push({
        mint: quoteMint,
        name: quote?.name || null,
        symbol: quote?.symbol || null,
        imageUrl: quote?.image_url || null,
        pool: attributes.address || null,
        protocol: "GeckoTerminal"
      });
    }
  }

  return tokens;
}

async function fetchGeckoTrending() {
  const url =
    `${GECKOTERMINAL_API}/networks/solana/trending_pools` +
    "?include=base_token,quote_token,dex" +
    "&duration=24h&page=1";

  const response = await fetchWithTimeout(url);

  return extractGeckoTokens(await response.json());
}

async function fetchDexDiscovery(endpoint) {
  const response = await fetchWithTimeout(
    `${DEXSCREENER_API}${endpoint}`
  );

  const data = await response.json();

  if (!Array.isArray(data)) return [];

  return data
    .filter((item) => item.chainId === "solana")
    .map((item) => ({
      mint: item.tokenAddress,
      name: null,
      symbol: null,
      imageUrl: item.icon || null,
      protocol: "DexScreener"
    }))
    .filter((item) => item.mint);
}

/*
 * Combines:
 * - GeckoTerminal Solana trending pools
 * - Latest DexScreener token profiles
 * - Latest DexScreener boosted tokens
 * - Top boosted DexScreener tokens
 *
 * This is discovery, not a claim to have every Solana token.
 */
export async function discoverSolanaTokens({
  force = false
} = {}) {
  const now = Date.now();

  if (
    !force &&
    discoveryCache.length &&
    now - discoveryUpdatedAt < DISCOVERY_CACHE_DURATION
  ) {
    return discoveryCache;
  }

  if (discoveryPromise) {
    return discoveryPromise;
  }

  discoveryPromise = (async () => {
    console.log("[Discovery] Finding Solana tokens...");

    const results = await Promise.allSettled([
      fetchGeckoTrending(),

      fetchDexDiscovery(
        "/token-profiles/latest/v1"
      ),

      fetchDexDiscovery(
        "/token-boosts/latest/v1"
      ),

      fetchDexDiscovery(
        "/token-boosts/top/v1"
      )
    ]);

    const combined = new Map();

    for (const result of results) {
      if (result.status !== "fulfilled") {
        console.warn(
          "[Discovery] Source unavailable:",
          result.reason?.message || result.reason
        );

        continue;
      }

      for (const raw of result.value) {
        const token = normaliseDiscoveredToken(raw);

        if (!token) continue;

        const existing = combined.get(token.mint);

        combined.set(token.mint, {
          ...existing,
          ...token,

          name:
            token.name !== "Unknown Token"
              ? token.name
              : existing?.name || "Unknown Token",

          symbol:
            token.symbol !== "UNKNOWN"
              ? token.symbol
              : existing?.symbol || "UNKNOWN",

          imageUrl:
            token.imageUrl ||
            existing?.imageUrl ||
            null
        });
      }
    }

    const discovered = Array.from(combined.values());

    if (discovered.length) {
      discoveryCache = discovered;
      discoveryUpdatedAt = Date.now();
    }

    console.log(
      "[Discovery] Solana tokens discovered:",
      discovered.length
    );

    if (!discovered.length && !discoveryCache.length) {
      console.warn(
        "[Discovery] No discovery sources returned tokens."
      );
    }

    return discovered.length
      ? discovered
      : discoveryCache;
  })();

  try {
    return await discoveryPromise;
  } finally {
    discoveryPromise = null;
  }
}

// --------------------------------------------------
// MARKET DATA ENRICHMENT
// --------------------------------------------------

export async function enrichTokens(
  tokens,
  {
    includeMetadata = false
  } = {}
) {
  if (!Array.isArray(tokens) || !tokens.length) {
    return [];
  }

  const uniqueTokens = Array.from(
    new Map(
      tokens
        .filter((token) => token?.mint)
        .map((token) => [token.mint, token])
    ).values()
  );

  const results = new Map();

  const pending = [];

  const now = Date.now();

  for (const token of uniqueTokens) {
    const cached = marketCache.get(token.mint);

    const cacheDuration = cached?.data
      ? MARKET_CACHE_DURATION
      : EMPTY_CACHE_DURATION;

    if (
      cached &&
      now - cached.updatedAt < cacheDuration
    ) {
      results.set(token.mint, cached.data);
    } else {
      pending.push(token);
    }
  }

  const batches = [];

  for (
    let i = 0;
    i < pending.length;
    i += BATCH_SIZE
  ) {
    batches.push(
      pending.slice(i, i + BATCH_SIZE)
    );
  }

  if (batches.length) {
    const freshResults = await processBatches(batches);

    for (const [mint, market] of freshResults.entries()) {
      if (market !== undefined) {
        results.set(mint, market);
      } else {
        const previous = marketCache.get(mint);

        results.set(
          mint,
          previous?.data ?? null
        );
      }
    }
  }

  return Promise.all(
    uniqueTokens.map(async (token) => {
      const market =
        results.get(token.mint) ?? null;

      let metadata = null;

      if (
        includeMetadata &&
        (!token.imageUrl ||
          !token.name ||
          token.name === "Unknown Token")
      ) {
        metadata = await fetchTokenMetadata(token.uri);
      }

      return {
        ...token,

        name:
          token.name === "Unknown Token"
            ? metadata?.name ||
              market?.tokenName ||
              token.name
            : token.name ||
              market?.tokenName ||
              "Unknown Token",

        symbol:
          token.symbol === "UNKNOWN"
            ? metadata?.symbol ||
              market?.tokenSymbol ||
              token.symbol
            : token.symbol ||
              market?.tokenSymbol ||
              "UNKNOWN",

        imageUrl:
          token.imageUrl ||
          market?.imageUrl ||
          metadata?.imageUrl ||
          null,

        market
      };
    })
  );
}

export function clearMarketCache() {
  marketCache.clear();
}

export function clearMetadataCache() {
  metadataCache.clear();
}

export function clearDiscoveryCache() {
  discoveryCache = [];
  discoveryUpdatedAt = 0;
  discoveryPromise = null;
}

export default {
  enrichTokens,
  discoverSolanaTokens,
  clearMarketCache,
  clearMetadataCache,
  clearDiscoveryCache
};