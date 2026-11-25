import { discoverSolanaTokens, searchAllCoins } from "./marketDataService.js";

class TokenService {
  constructor() {
    this.tokens = new Map();
    this.listeners = new Set();
    this.connected = false;
    this.started = false;
    this.discoveryTimer = null;
    this.searches = new Map();
  }

  connect() {
    if (this.started) return;
    this.started = true;
    this.connected = true;
    this.discover();
    this.discoveryTimer = setInterval(() => this.discover(true), 3 * 60 * 1000);
    this.notifyListeners();
  }

  async discover(force = false) {
    try {
      const found = await discoverSolanaTokens({ force });
      this.addDiscoveredTokens(found);
    } catch (error) {
      console.error("[TokenService] GeckoTerminal discovery failed:", error);
    }
  }

  addDiscoveredTokens(tokens) {
    if (!Array.isArray(tokens)) return;
    for (const token of tokens) {
      if (!token?.mint) continue;
      const previous = this.tokens.get(token.mint) || {};
      this.tokens.set(token.mint, {
        ...previous,
        ...token,
        imageUrl: token.imageUrl || previous.imageUrl || null
      });
    }
    this.notifyListeners();
  }

  addToken(token) { this.addDiscoveredTokens([token]); }

  getTokens() { return [...this.tokens.values()]; }

  async searchTokens(term) {
    const key = String(term || "").trim().toLowerCase();
    if (key.length < 2) return [];
    if (this.searches.has(key)) return this.searches.get(key);
    const request = searchAllCoins(term).catch(error => {
      console.error("[TokenService] Coin search failed:", error);
      throw error;
    }).finally(() => this.searches.delete(key));
    this.searches.set(key, request);
    return request;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener({ tokens: this.getTokens(), connected: this.connected });
    return () => this.listeners.delete(listener);
  }

  notifyListeners() {
    const payload = { tokens: this.getTokens(), connected: this.connected };
    for (const listener of this.listeners) {
      try { listener(payload); } catch (error) { console.error(error); }
    }
  }

  disconnect() {
    if (this.discoveryTimer) clearInterval(this.discoveryTimer);
    this.discoveryTimer = null;
    this.started = false;
    this.connected = false;
    this.notifyListeners();
  }
}

const tokenService = new TokenService();
export default tokenService;
