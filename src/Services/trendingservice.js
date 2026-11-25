import tokenService from "./tokenservice.js";
import { enrichTokens } from "./marketDataService.js";

const REFRESH_INTERVAL = 90_000;
const MAX_TRENDING = 20;
const MIN_VOLUME_24H = 25_000;
const MIN_LIQUIDITY = 5_000;

class TrendingService {
  constructor() {
    this.trending = [];
    this.listeners = new Set();
    this.started = false;
    this.interval = null;
    this.unsubscribe = null;
    this.refreshing = false;
  }

  start() {
    if (this.started) return;
    this.started = true;
    this.unsubscribe = tokenService.subscribe(({ tokens }) => {
      if (tokens.length) this.refresh(tokens);
    });
    tokenService.connect();
    this.interval = setInterval(() => this.refresh(tokenService.getTokens()), REFRESH_INTERVAL);
  }

  async refresh(tokens) {
    if (!this.started || this.refreshing || !tokens?.length) return;
    this.refreshing = true;
    try {
      const enriched = await enrichTokens(tokens.slice(0, 30));
      this.trending = enriched.filter(t => t.market &&
        Number(t.market.volume24h || 0) >= MIN_VOLUME_24H &&
        Number(t.market.liquidity || 0) >= MIN_LIQUIDITY)
        .sort((a, b) => Number(b.market.volume24h || 0) - Number(a.market.volume24h || 0))
        .slice(0, MAX_TRENDING);
      this.notify();
    } catch (error) {
      console.error("[TrendingService] Gecko refresh failed:", error);
    } finally { this.refreshing = false; }
  }

  getTrending() { return this.trending; }
  subscribe(listener) { this.listeners.add(listener); listener(this.trending); return () => this.listeners.delete(listener); }
  notify() { this.listeners.forEach(listener => listener(this.trending)); }
  stop() {
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
    if (this.unsubscribe) this.unsubscribe();
    this.unsubscribe = null;
    this.started = false;
  }
}

export default new TrendingService();
