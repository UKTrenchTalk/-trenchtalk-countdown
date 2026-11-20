import tokenService from "./tokenservice.js";

import {
  enrichTokens,
  discoverSolanaTokens
} from "./marketDataService.js";

const REFRESH_INTERVAL = 60_000;
const DISCOVERY_INTERVAL = 120_000;

const MAX_SOURCE_TOKENS = 1000;
const MAX_TRENDING = 20;

// Minimum requirements for Trending.
const MIN_VOLUME_24H = 500_000;
const MIN_MARKET_CAP = 500_000;
const MIN_LIQUIDITY = 25_000;

class TrendingService {
  constructor() {
    this.tokens = [];
    this.trending = [];

    this.listeners = new Set();

    this.started = false;
    this.refreshing = false;
    this.refreshQueued = false;

    this.interval = null;
    this.discoveryInterval = null;

    this.unsubscribe = null;
    this.discoveryRunning = false;
  }

  start() {
    if (this.started) return;

    this.started = true;

    console.log(
      "[TrendingService] Starting Solana discovery and leaderboard"
    );

    // Subscribe to the combined token catalogue.
    this.unsubscribe = tokenService.subscribe(
      ({ tokens, connected }) => {
        this.tokens = tokens;

        console.log(
          "[TrendingService] Shrine connected:",
          connected,
          "| catalogue:",
          tokens.length
        );

        this.refresh();
      }
    );

    // Start Shrine and Firestore.
    tokenService.connect();

    // Start independent token discovery immediately.
    this.discover();

    // Refresh market data every minute.
    this.interval = setInterval(
      () => this.refresh(),
      REFRESH_INTERVAL
    );

    // Discover additional tokens every two minutes.
    this.discoveryInterval = setInterval(
      () => this.discover(),
      DISCOVERY_INTERVAL
    );
  }

  async discover() {
    if (!this.started || this.discoveryRunning) return;

    this.discoveryRunning = true;

    try {
      console.log(
        "[TrendingService] Running independent token discovery..."
      );

      const discovered = await discoverSolanaTokens();

      if (!this.started) return;

      if (!discovered.length) {
        console.warn(
          "[TrendingService] Discovery returned no tokens"
        );

        return;
      }

      console.log(
        "[TrendingService] Discovered:",
        discovered.length,
        "Solana tokens"
      );

      // Add discovered tokens to the persistent catalogue.
      tokenService.addDiscoveredTokens(discovered);

    } catch (error) {
      console.error(
        "[TrendingService] Discovery failed:",
        error
      );
    } finally {
      this.discoveryRunning = false;
    }
  }

  qualifies(token) {
    const market = token?.market;

    if (!market) return false;

    const volume = Number(market.volume24h) || 0;

    const liquidity = Number(market.liquidity) || 0;

    const marketCap = Number(
      market.marketCapOrFdv ??
      market.marketCap ??
      market.fdv ??
      0
    );

    const price = Number(market.priceUsd) || 0;

    return (
      volume >= MIN_VOLUME_24H &&
      marketCap >= MIN_MARKET_CAP &&
      liquidity >= MIN_LIQUIDITY &&
      price > 0
    );
  }

  rankTokens(tokens) {
    const unique = new Map();

    for (const token of tokens) {
      if (!token?.mint || !this.qualifies(token)) continue;

      const existing = unique.get(token.mint);

      // Keep the version with the newest market data.
      if (
        !existing ||
        Number(token.market?.updatedAt || 0) >=
          Number(existing.market?.updatedAt || 0)
      ) {
        unique.set(token.mint, token);
      }
    }

    return Array.from(unique.values())
      .sort((a, b) => {
        const volumeDifference =
          Number(b.market.volume24h || 0) -
          Number(a.market.volume24h || 0);

        if (volumeDifference !== 0) {
          return volumeDifference;
        }

        return (
          Number(b.market.liquidity || 0) -
          Number(a.market.liquidity || 0)
        );
      })
      .slice(0, MAX_TRENDING);
  }

  async refresh() {
    if (!this.started) return;

    if (this.refreshing) {
      this.refreshQueued = true;
      return;
    }

    if (!this.tokens.length) {
      this.trending = [];
      this.notify();
      return;
    }

    this.refreshing = true;

    try {
      // Use the combined Shrine and discovery catalogue.
      const sourceTokens = this.tokens
        .filter((token) => token?.mint)
        .slice(0, MAX_SOURCE_TOKENS);

      console.log(
        "[TrendingService] Enriching",
        sourceTokens.length,
        "tokens"
      );

      const enriched = await enrichTokens(
        sourceTokens,
        {
          includeMetadata: false
        }
      );

      if (!this.started) return;

      const ranked = this.rankTokens(enriched);

      this.trending = ranked;

      const qualifiedCount = enriched.filter(
        (token) => this.qualifies(token)
      ).length;

      console.log(
        "[TrendingService] Market-data tokens:",
        enriched.filter((token) => token.market).length
      );

      console.log(
        "[TrendingService] Qualified tokens:",
        qualifiedCount
      );

      console.log(
        "[TrendingService] Trending leaderboard:",
        this.trending.length
      );

      this.notify();

    } catch (error) {
      console.error(
        "[TrendingService] Refresh failed:",
        error
      );

    } finally {
      this.refreshing = false;

      if (this.refreshQueued && this.started) {
        this.refreshQueued = false;

        this.refresh();
      }
    }
  }

  getTrending() {
    return this.trending;
  }

  subscribe(listener) {
    this.listeners.add(listener);

    listener(this.trending);

    return () => {
      this.listeners.delete(listener);
    };
  }

  notify() {
    this.listeners.forEach((listener) => {
      try {
        listener(this.trending);
      } catch (error) {
        console.error(
          "[TrendingService] Listener error:",
          error
        );
      }
    });
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
    }

    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
    }

    this.interval = null;
    this.discoveryInterval = null;

    if (this.unsubscribe) {
      this.unsubscribe();
    }

    this.unsubscribe = null;

    this.started = false;

    this.refreshQueued = false;

    console.log(
      "[TrendingService] Stopped"
    );
  }
}

const trendingService = new TrendingService();

export default trendingService;