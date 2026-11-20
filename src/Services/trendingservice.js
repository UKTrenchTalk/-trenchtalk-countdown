import tokenService from "./tokenservice.js";
import { enrichTokens } from "./marketDataService.js";

const REFRESH_INTERVAL = 60_000;
const MAX_TOKENS = 200;
const MAX_TRENDING = 20;

class TrendingService {
  constructor() {
    this.tokens = [];
    this.trending = [];
    this.listeners = new Set();
    this.started = false;
    this.refreshing = false;
    this.interval = null;
    this.unsubscribe = null;
  }

  start() {
    if (this.started) return;

    this.started = true;

    console.log("[TrendingService] Starting...");

    this.unsubscribe = tokenService.subscribe(({ tokens, connected }) => {
      this.tokens = tokens.slice(0, MAX_TOKENS);

      console.log("[TrendingService] Shrine connected:", connected);
      console.log("[TrendingService] Tokens received:", this.tokens.length);

      if (this.tokens.length > 0) {
        this.refresh();
      }
    });

    tokenService.connect();

    this.refresh();

    this.interval = setInterval(() => {
      this.refresh();
    }, REFRESH_INTERVAL);
  }

  calculateScore(token) {
    const market = token.market;

    if (!market) return 0;

    const volume24h = Number(market.volume24h) || 0;
    const volume1h = Number(market.volume1h) || 0;
    const volume5m = Number(market.volume5m) || 0;

    const liquidity = Number(market.liquidity) || 0;

    const change5m = Number(market.priceChange5m) || 0;
    const change1h = Number(market.priceChange1h) || 0;

    const buys5m = Number(market.buys5m) || 0;
    const sells5m = Number(market.sells5m) || 0;

    const buys24h = Number(market.buys24h) || 0;
    const sells24h = Number(market.sells24h) || 0;

    const totalTrades5m = buys5m + sells5m;
    const totalTrades24h = buys24h + sells24h;

    const buyPressure = totalTrades5m > 0
      ? buys5m / totalTrades5m
      : 0;

    const volumeScore = Math.log10(volume24h + 1) * 8;
    const recentVolumeScore = Math.log10(volume1h + 1) * 8;
    const momentumVolumeScore = Math.log10(volume5m + 1) * 5;

    const liquidityScore = Math.log10(liquidity + 1) * 5;

    const activityScore = Math.log10(totalTrades24h + 1) * 8;

    const recentActivityScore = Math.log10(totalTrades5m + 1) * 8;

    const momentumScore = Math.max(
      -30,
      Math.min(30, change1h * 1.5)
    );

    const shortMomentumScore = Math.max(
      -20,
      Math.min(20, change5m)
    );

    const buyingScore = buyPressure * 20;

    return (
      volumeScore +
      recentVolumeScore +
      momentumVolumeScore +
      liquidityScore +
      activityScore +
      recentActivityScore +
      momentumScore +
      shortMomentumScore +
      buyingScore
    );
  }

  async refresh() {
    if (this.refreshing || this.tokens.length === 0) return;

    this.refreshing = true;

    try {
      console.log(
        "[TrendingService] Updating",
        this.tokens.length,
        "tokens"
      );

      const enriched = await enrichTokens(this.tokens);

      const ranked = enriched
        .filter((token) => {
          const price = Number(token.market?.priceUsd);
          const liquidity = Number(token.market?.liquidity);

          return (
            token.market !== null &&
            Number.isFinite(price) &&
            price > 0 &&
            Number.isFinite(liquidity) &&
            liquidity > 0
          );
        })
        .map((token) => ({
          ...token,
          trendingScore: this.calculateScore(token)
        }))
        .sort((a, b) => b.trendingScore - a.trendingScore);

      this.trending = ranked.slice(0, MAX_TRENDING);

      console.log(
        "[TrendingService] Tokens with valid market data:",
        ranked.length
      );

      console.log(
        "[TrendingService] Trending coins:",
        this.trending.length
      );

      this.notify();

    } catch (error) {
      console.error("[TrendingService] Error:", error);

    } finally {
      this.refreshing = false;
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
      listener(this.trending);
    });
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    this.started = false;
  }
}

const trendingService = new TrendingService();

export default trendingService;