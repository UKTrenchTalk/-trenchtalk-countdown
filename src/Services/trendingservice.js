import tokenService from "./tokenservice.js";

const REFRESH_INTERVAL = 90_000;
const MAX_TRENDING = 20;

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
      // GeckoTerminal's trending/new-pool responses already contain the pool
      // price, 24h volume and liquidity. Do not fan out into one API call per token.
      // Keep active pools even when they fall below arbitrary volume thresholds.
      this.trending = tokens
        .filter(token => token?.mint && token.market && (
          Number(token.market.volume24h || 0) > 0 || Number(token.market.liquidity || 0) > 0
        ))
        .sort((a, b) => {
          const volume = Number(b.market?.volume24h || 0) - Number(a.market?.volume24h || 0);
          return volume || Number(b.market?.liquidity || 0) - Number(a.market?.liquidity || 0);
        })
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
