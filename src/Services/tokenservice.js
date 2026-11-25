import { io } from "socket.io-client";

import {
  collection,
  getDocs,
  limit,
  orderBy,
  query
} from "firebase/firestore";

import { db } from "../firebase";

const SHRINE_URL = "https://sol.shrine.trade";
const TOKEN_COLLECTION = "solanaTokens";

// Keep the initial database read deliberately small.
// The browser cache prevents this query running on every page load.
const MAX_STORED_TOKENS = 250;
const CACHE_KEY = "trenchtalk_token_catalogue_v1";
const CACHE_TTL = 30 * 60 * 1000;

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
    this.loading = false;
    this.firestoreLoaded = false;

    this.cacheSaveTimer = null;
  }

  connect() {
    if (this.socket) return;

    console.log("[TokenService] Starting...");

    // Load the local cache immediately, then refresh it from Firestore
    // only when the cache is missing or expired.
    this.loadStoredTokens();

    this.socket = io(SHRINE_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000
    });

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

    this.socket.on("new_token", (rawToken) => {
      this.addToken(rawToken);
    });

    this.socket.on("disconnect", () => {
      console.log("[TokenService] Disconnected from Shrine");
      this.connected = false;
      this.notifyListeners();
    });

    this.socket.on("connect_error", (error) => {
      console.error(
        "[TokenService] Connection error:",
        error.message
      );
    });
  }

  async loadStoredTokens() {
    if (this.firestoreLoaded || this.loading) return;

    this.loading = true;

    // Use the browser's cached catalogue first.
    const cached = this.readLocalCache();

    if (cached.length) {
      cached.forEach((token) => {
        if (token?.mint) this.tokens.set(token.mint, token);
      });

      this.trimTokens();
      this.firestoreLoaded = true;
      this.loading = false;
      this.notifyListeners();

      console.log(
        "[TokenService] Loaded local cached tokens:",
        this.tokens.size
      );

      // A valid cache is enough for this session. No Firestore read.
      return;
    }

    try {
      console.log("[TokenService] Loading stored tokens from Firestore...");

      const tokensRef = collection(db, TOKEN_COLLECTION);
      const tokensQuery = query(
        tokensRef,
        orderBy("detectedAtMs", "desc"),
        limit(MAX_STORED_TOKENS)
      );

      const snapshot = await getDocs(tokensQuery);

      snapshot.forEach((document) => {
        const data = document.data();
        if (!data?.mint) return;

        const existing = this.tokens.get(data.mint);

        this.tokens.set(data.mint, {
          ...existing,
          ...data
        });
      });

      this.trimTokens();
      this.writeLocalCache();
      this.firestoreLoaded = true;

      console.log(
        "[TokenService] Firestore tokens loaded:",
        this.tokens.size
      );
    } catch (error) {
      console.error(
        "[TokenService] Firestore loading error:",
        error
      );
    } finally {
      this.loading = false;
      this.notifyListeners();
    }
  }

  readLocalCache() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return [];

      const parsed = JSON.parse(raw);

      if (
        !parsed ||
        !Array.isArray(parsed.tokens) ||
        Date.now() - Number(parsed.savedAt || 0) > CACHE_TTL
      ) {
        localStorage.removeItem(CACHE_KEY);
        return [];
      }

      return parsed.tokens;
    } catch (error) {
      console.warn("[TokenService] Could not read local cache:", error);
      return [];
    }
  }

  scheduleCacheSave() {
    if (this.cacheSaveTimer) {
      clearTimeout(this.cacheSaveTimer);
    }

    this.cacheSaveTimer = setTimeout(() => {
      this.writeLocalCache();
      this.cacheSaveTimer = null;
    }, 1500);
  }

  writeLocalCache() {
    try {
      const tokens = this.getTokens().slice(0, MAX_STORED_TOKENS);

      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({
          savedAt: Date.now(),
          tokens
        })
      );
    } catch (error) {
      // Storage may be unavailable or full; the app can still operate in memory.
      console.warn("[TokenService] Could not save local cache:", error);
    }
  }

  normaliseShrineToken(rawToken) {
    if (!rawToken?.mint) return null;

    const existing = this.tokens.get(rawToken.mint);
    const timestamp = Number(rawToken.timestamp);

    const createdAtMs =
      timestamp > 0
        ? timestamp < 1000000000000
          ? timestamp * 1000
          : timestamp
        : existing?.createdAtMs || Date.now();

    const name =
      rawToken.name?.trim() ||
      existing?.name ||
      "Unknown Token";

    const symbol =
      rawToken.symbol?.trim() ||
      existing?.symbol ||
      "UNKNOWN";

    return {
      ...existing,
      mint: rawToken.mint,
      pool: rawToken.pool || existing?.pool || null,
      name,
      symbol,
      nameLower: name.toLowerCase(),
      symbolLower: symbol.toLowerCase(),
      protocol: rawToken.protocol || existing?.protocol || "UNKNOWN",
      decimals: rawToken.decimals ?? existing?.decimals ?? 6,
      quote: rawToken.quote || existing?.quote || null,
      supply: rawToken.supply ?? existing?.supply ?? null,
      creator: rawToken.creator || existing?.creator || null,
      uri: rawToken.uri || existing?.uri || null,
      timestamp:
        rawToken.timestamp ||
        existing?.timestamp ||
        Math.floor(Date.now() / 1000),
      createdAtMs,
      detectedAtMs:
        Number(existing?.detectedAtMs) || Date.now(),
      receivedAt: Date.now(),
      source: "shrine"
    };
  }

  addToken(rawToken) {
    const token = this.normaliseShrineToken(rawToken);
    if (!token) return;

    // Update memory only. Do not let every browser session write the same
    // live token into Firestore; shared ingestion should be server-side.
    this.tokens.set(token.mint, token);
    this.trimTokens();
    this.scheduleCacheSave();
    this.notifyListeners();
  }

  addDiscoveredTokens(discoveredTokens) {
    if (!Array.isArray(discoveredTokens)) return;

    let added = 0;
    const now = Date.now();

    for (const rawToken of discoveredTokens) {
      if (!rawToken?.mint) continue;

      const existing = this.tokens.get(rawToken.mint);

      const name =
        rawToken.name ||
        rawToken.tokenName ||
        existing?.name ||
        "Unknown Token";

      const symbol =
        rawToken.symbol ||
        rawToken.tokenSymbol ||
        existing?.symbol ||
        "UNKNOWN";

      const token = {
        ...existing,
        mint: rawToken.mint,
        name,
        symbol,
        nameLower: name.toLowerCase(),
        symbolLower: symbol.toLowerCase(),
        protocol:
          rawToken.protocol ||
          rawToken.dexId ||
          existing?.protocol ||
          "Solana",
        pool:
          rawToken.pool ||
          rawToken.pairAddress ||
          existing?.pool ||
          null,
        uri: rawToken.uri || existing?.uri || null,
        imageUrl:
          rawToken.imageUrl ||
          rawToken.icon ||
          existing?.imageUrl ||
          null,
        detectedAtMs:
          Number(existing?.detectedAtMs) || now,
        discoveredAtMs:
          Number(existing?.discoveredAtMs) || now,
        receivedAt: now,
        source:
          existing?.source === "shrine"
            ? "shrine"
            : "discovery"
      };

      if (!existing) added++;

      this.tokens.set(token.mint, token);
    }

    if (discoveredTokens.length) {
      this.trimTokens();
      this.scheduleCacheSave();
      this.notifyListeners();
    }

    if (added > 0) {
      console.log(
        "[TokenService] New locally discovered tokens:",
        added,
        "| catalogue size:",
        this.tokens.size
      );
    }
  }

  trimTokens() {
    if (this.tokens.size <= MAX_STORED_TOKENS * 4) return;

    const sorted = Array.from(this.tokens.entries()).sort(
      (a, b) =>
        Number(b[1].detectedAtMs || 0) -
        Number(a[1].detectedAtMs || 0)
    );

    this.tokens = new Map(sorted.slice(0, MAX_STORED_TOKENS * 4));
  }

  getTokens() {
    return Array.from(this.tokens.values()).sort(
      (a, b) =>
        Number(b.detectedAtMs || 0) -
        Number(a.detectedAtMs || 0)
    );
  }

  async searchTokens(searchTerm) {
    const term = String(searchTerm || "").trim().toLowerCase();
    if (!term) return [];

    // Search the in-memory catalogue. The previous implementation ran
    // three Firestore queries for every search, which could be expensive.
    const results = [];

    for (const token of this.tokens.values()) {
      const matches =
        token.mint?.toLowerCase().includes(term) ||
        token.name?.toLowerCase().includes(term) ||
        token.symbol?.toLowerCase().includes(term);

      if (matches) results.push(token);
    }

    return results.sort(
      (a, b) =>
        Number(b.detectedAtMs || 0) -
        Number(a.detectedAtMs || 0)
    );
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

    this.listeners.forEach((listener) => {
      try {
        listener(data);
      } catch (error) {
        console.error("[TokenService] Listener error:", error);
      }
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    if (this.cacheSaveTimer) {
      clearTimeout(this.cacheSaveTimer);
      this.cacheSaveTimer = null;
    }

    this.writeLocalCache();

    this.connected = false;
    this.firestoreLoaded = false;

    console.log("[TokenService] Disconnected");
  }
}

const tokenService = new TokenService();

export default tokenService;
