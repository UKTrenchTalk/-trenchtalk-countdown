import { io } from "socket.io-client";

import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  where
} from "firebase/firestore";

import { db } from "../firebase";

const SHRINE_URL = "https://sol.shrine.trade";

const TOKEN_COLLECTION = "solanaTokens";

const MAX_TOKENS = 5000;
const SEARCH_LIMIT = 50;

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

    this.firestoreUnsubscribe = null;

    this.persistQueue = Promise.resolve();
  }

  connect() {
    if (this.socket) return;

    console.log("[TokenService] Starting...");

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

  loadStoredTokens() {
    if (this.firestoreUnsubscribe) return;

    this.loading = true;

    console.log("[TokenService] Loading stored tokens...");

    const tokensRef = collection(db, TOKEN_COLLECTION);

    const tokensQuery = query(
      tokensRef,
      orderBy("detectedAtMs", "desc"),
      limit(MAX_TOKENS)
    );

    this.firestoreUnsubscribe = onSnapshot(
      tokensQuery,
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          const data = change.doc.data();

          if (!data?.mint) return;

          if (change.type === "removed") {
            this.tokens.delete(data.mint);
            return;
          }

          const existing = this.tokens.get(data.mint);

          const token = {
            ...data,
            detectedAtMs:
              Number(data.detectedAtMs) ||
              Number(existing?.detectedAtMs) ||
              Date.now()
          };

          this.tokens.set(token.mint, {
            ...existing,
            ...token
          });
        });

        this.trimTokens();

        this.loading = false;

        console.log(
          "[TokenService] Stored tokens loaded:",
          this.tokens.size
        );

        this.notifyListeners();
      },
      (error) => {
        console.error(
          "[TokenService] Firestore loading error:",
          error
        );

        this.loading = false;

        this.notifyListeners();
      }
    );
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

    return {
      ...existing,

      mint: rawToken.mint,

      pool: rawToken.pool || existing?.pool || null,

      name:
        rawToken.name?.trim() ||
        existing?.name ||
        "Unknown Token",

      symbol:
        rawToken.symbol?.trim() ||
        existing?.symbol ||
        "UNKNOWN",

      nameLower: (
        rawToken.name?.trim() ||
        existing?.name ||
        "Unknown Token"
      ).toLowerCase(),

      symbolLower: (
        rawToken.symbol?.trim() ||
        existing?.symbol ||
        "UNKNOWN"
      ).toLowerCase(),

      protocol:
        rawToken.protocol ||
        existing?.protocol ||
        "UNKNOWN",

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

    this.tokens.set(token.mint, token);

    this.trimTokens();

    this.notifyListeners();

    this.persistToken(token);
  }

  /*
   * Add independently discovered tokens.
   *
   * These tokens are saved to Firestore and become
   * available to Trending and token search.
   *
   * They are marked as "discovery", not "shrine",
   * so they can be kept out of the New tab.
   */
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

        uri:
          rawToken.uri ||
          existing?.uri ||
          null,

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

        // Never downgrade a Shrine token to discovery.
        source:
          existing?.source === "shrine"
            ? "shrine"
            : "discovery"
      };

      this.tokens.set(token.mint, token);

      this.persistToken(token);

      added++;
    }

    if (added > 0) {
      this.trimTokens();

      this.notifyListeners();

      console.log(
        "[TokenService] Discovered tokens added:",
        added,
        "| catalogue size:",
        this.tokens.size
      );
    }
  }

  persistToken(token) {
    if (!token?.mint) return Promise.resolve();

    const tokenRef = doc(
      db,
      TOKEN_COLLECTION,
      token.mint
    );

    this.persistQueue = this.persistQueue
      .then(() => setDoc(tokenRef, token, { merge: true }))
      .catch((error) => {
        console.error(
          "[TokenService] Could not save token:",
          token.symbol,
          error
        );
      });

    return this.persistQueue;
  }

  trimTokens() {
    if (this.tokens.size <= MAX_TOKENS) return;

    const sorted = Array.from(this.tokens.entries())
      .sort(
        (a, b) =>
          Number(b[1].detectedAtMs || 0) -
          Number(a[1].detectedAtMs || 0)
      );

    this.tokens = new Map(
      sorted.slice(0, MAX_TOKENS)
    );
  }

  getTokens() {
    return Array.from(this.tokens.values()).sort(
      (a, b) =>
        Number(b.detectedAtMs || 0) -
        Number(a.detectedAtMs || 0)
    );
  }

  async searchTokens(searchTerm) {
    const term = searchTerm.trim().toLowerCase();

    if (!term) return [];

    console.log("[TokenService] Searching:", term);

    const results = new Map();

    // Search the local catalogue first.
    for (const token of this.tokens.values()) {
      const matches =
        token.mint?.toLowerCase().includes(term) ||
        token.name?.toLowerCase().includes(term) ||
        token.symbol?.toLowerCase().includes(term);

      if (matches) {
        results.set(token.mint, token);
      }
    }

    // Search Firestore for older or unloaded tokens.
    try {
      const tokensRef = collection(db, TOKEN_COLLECTION);

      const searches = [
        query(
          tokensRef,
          where("mint", "==", searchTerm.trim()),
          limit(SEARCH_LIMIT)
        ),

        query(
          tokensRef,
          where("nameLower", ">=", term),
          where("nameLower", "<=", term + "\uf8ff"),
          limit(SEARCH_LIMIT)
        ),

        query(
          tokensRef,
          where("symbolLower", ">=", term),
          where("symbolLower", "<=", term + "\uf8ff"),
          limit(SEARCH_LIMIT)
        )
      ];

      const snapshots = await Promise.all(
        searches.map((searchQuery) => getDocs(searchQuery))
      );

      snapshots.forEach((snapshot) => {
        snapshot.forEach((document) => {
          const token = document.data();

          if (token.mint) {
            results.set(token.mint, token);
          }
        });
      });

    } catch (error) {
      console.error(
        "[TokenService] Firestore search error:",
        error
      );
    }

    return Array.from(results.values()).sort(
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
        console.error(
          "[TokenService] Listener error:",
          error
        );
      }
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    if (this.firestoreUnsubscribe) {
      this.firestoreUnsubscribe();
      this.firestoreUnsubscribe = null;
    }

    this.connected = false;

    console.log("[TokenService] Disconnected");
  }
}

const tokenService = new TokenService();

export default tokenService;