const DEXSCREENER_API = "https://api.dexscreener.com";

const CACHE_DURATION = 60_000;
const cache = new Map();

function getBestPair(pairs, mint) {
  if (!Array.isArray(pairs)) return null;

  const matchingPairs = pairs.filter((pair) => {
    return (
      pair.baseToken?.address?.toLowerCase() === mint.toLowerCase() ||
      pair.quoteToken?.address?.toLowerCase() === mint.toLowerCase()
    );
  });

  if (!matchingPairs.length) return null;

  return matchingPairs.sort(
    (a, b) =>
      (Number(b.liquidity?.usd) || 0) -
      (Number(a.liquidity?.usd) || 0)
  )[0];
}

function normaliseMarketData(pair, mint) {
  if (!pair) return null;

  const isBaseToken =
    pair.baseToken?.address?.toLowerCase() === mint.toLowerCase();

  const token = isBaseToken
    ? pair.baseToken
    : pair.quoteToken;

  return {
    priceUsd: Number(pair.priceUsd) || null,

    marketCap: pair.marketCap ?? pair.fdv ?? null,
    fdv: pair.fdv ?? null,
    liquidity: pair.liquidity?.usd ?? null,

    volume24h: pair.volume?.h24 ?? null,
    volume6h: pair.volume?.h6 ?? null,
    volume1h: pair.volume?.h1 ?? null,
    volume5m: pair.volume?.m5 ?? null,

    priceChange5m: pair.priceChange?.m5 ?? null,
    priceChange1h: pair.priceChange?.h1 ?? null,
    priceChange6h: pair.priceChange?.h6 ?? null,
    priceChange24h: pair.priceChange?.h24 ?? null,

    buys24h: pair.txns?.h24?.buys ?? 0,
    sells24h: pair.txns?.h24?.sells ?? 0,

    buys1h: pair.txns?.h1?.buys ?? 0,
    sells1h: pair.txns?.h1?.sells ?? 0,

    buys5m: pair.txns?.m5?.buys ?? 0,
    sells5m: pair.txns?.m5?.sells ?? 0,

    imageUrl: pair.info?.imageUrl ?? null,

    pairAddress: pair.pairAddress ?? null,
    dexId: pair.dexId ?? null,
    pairUrl: pair.url ?? null,

    tokenName: token?.name ?? null,
    tokenSymbol: token?.symbol ?? null,

    pairCreatedAt: pair.pairCreatedAt ?? null,

    updatedAt: Date.now()
  };
}

async function fetchTokenBatch(mints) {
  const addresses = mints.join(",");

  const url = `${DEXSCREENER_API}/tokens/v1/solana/${addresses}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`DexScreener HTTP ${response.status}`);
  }

  const data = await response.json();

  if (!Array.isArray(data)) {
    console.warn("[DexScreener] Unexpected response:", data);
    return [];
  }

  return data;
}

export async function enrichTokens(tokens) {
  if (!Array.isArray(tokens) || tokens.length === 0) {
    return [];
  }

  const now = Date.now();

  const results = new Map();
  const tokensToFetch = [];

  for (const token of tokens) {
    const cached = cache.get(token.mint);

    if (cached && now - cached.updatedAt < CACHE_DURATION) {
      results.set(token.mint, cached.data);
    } else {
      tokensToFetch.push(token);
    }
  }

  // DexScreener supports batches of up to 30 token addresses.
  for (let i = 0; i < tokensToFetch.length; i += 30) {
    const batch = tokensToFetch.slice(i, i + 30);

    const mints = batch.map((token) => token.mint);

    try {
      console.log(
        "[DexScreener] Requesting:",
        mints.length,
        "tokens"
      );

      const pairs = await fetchTokenBatch(mints);

      console.log(
        "[DexScreener] Returned pairs:",
        pairs.length
      );

      for (const token of batch) {
        const bestPair = getBestPair(pairs, token.mint);

        const marketData = normaliseMarketData(
          bestPair,
          token.mint
        );

        if (marketData) {
          console.log(
            `[DexScreener] Found market data: ${token.symbol}`
          );
        } else {
          console.log(
            `[DexScreener] No pair found yet: ${token.symbol} (${token.mint})`
          );
        }

        results.set(token.mint, marketData);

        cache.set(token.mint, {
          data: marketData,
          updatedAt: Date.now()
        });
      }
    } catch (error) {
      console.error(
        "[DexScreener] Request failed:",
        error.message
      );

      for (const token of batch) {
        results.set(token.mint, null);
      }
    }
  }

  // Combine Shrine token data with DexScreener market data.
  return tokens.map((token) => {
    const market = results.get(token.mint) ?? null;

    return {
      ...token,

      name:
        token.name === "Unknown Token"
          ? market?.tokenName || token.name
          : token.name,

      symbol:
        token.symbol === "UNKNOWN"
          ? market?.tokenSymbol || token.symbol
          : token.symbol,

      imageUrl:
        token.imageUrl ||
        market?.imageUrl ||
        null,

      market
    };
  });
}

export function clearMarketCache() {
  cache.clear();
}

export default {
  enrichTokens,
  clearMarketCache
};