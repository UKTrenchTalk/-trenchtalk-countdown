import { io } from "socket.io-client";

const SHRINE_URL = "https://sol.shrine.trade";

const PROTOCOLS = [
  "PUMPFUN",
  "PUMPFUN_MAYHEM",
  "PUMPSWAP",
  "METEORA",
  "METEORA_DBC",
  "RAYDIUM",
  "BONK",
  "STONKFUN"
];

class TokenService {
  constructor() {
    this.socket = null;
    this.tokens = new Map();
    this.listeners = new Set();
    this.connected = false;
  }

  connect() {
    if (this.socket) return;

    this.socket = io(SHRINE_URL);

    this.socket.on("connect", () => {
      console.log("[TokenService] Connected to Shrine");

      this.connected = true;

      this.socket.emit(
        "subscribe_new_tokens",
        { protocols: PROTOCOLS },
        (response) => {
          console.log("[TokenService] Subscription:", response);
        }
      );

      this.notifyListeners();
    });

    this.socket.on("new_token", (token) => {
      this.addToken(token);
    });

    this.socket.on("disconnect", () => {
      console.log("[TokenService] Disconnected from Shrine");
      this.connected = false;
      this.notifyListeners();
    });

    this.socket.on("connect_error", (error) => {
      console.error("[TokenService] Connection error:", error.message);
    });
  }

  addToken(rawToken) {
    if (!rawToken?.mint) return;

    const token = {
      mint: rawToken.mint,
      pool: rawToken.pool || null,
      name: rawToken.name?.trim() || "Unknown Token",
      symbol: rawToken.symbol?.trim() || "UNKNOWN",
      protocol: rawToken.protocol || "UNKNOWN",
      decimals: rawToken.decimals ?? 6,
      quote: rawToken.quote || null,
      supply: rawToken.supply ?? null,
      creator: rawToken.creator || null,
      uri: rawToken.uri || null,
      timestamp: rawToken.timestamp || Math.floor(Date.now() / 1000),
      receivedAt: Date.now()
    };

    // Prevent duplicate tokens.
    this.tokens.set(token.mint, token);

    // Keep the latest 200 tokens in memory.
    if (this.tokens.size > 200) {
      const oldestMint = this.tokens.keys().next().value;
      this.tokens.delete(oldestMint);
    }

    this.notifyListeners();
  }

  getTokens() {
    return Array.from(this.tokens.values()).reverse();
  }

  subscribe(listener) {
    this.listeners.add(listener);

    listener({
      tokens: this.getTokens(),
      connected: this.connected
    });

    return () => {
      this.listeners.delete(listener);
    };
  }

  notifyListeners() {
    const data = {
      tokens: this.getTokens(),
      connected: this.connected
    };

    this.listeners.forEach((listener) => listener(data));
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
    }
  }
}

const tokenService = new TokenService();

export default tokenService;