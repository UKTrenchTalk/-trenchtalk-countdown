import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import Countdown from "./countdown.jsx";
import Login from "./pages/login.jsx";
import trendingService from "./Services/trendingservice.js";
import tokenService from "./Services/tokenservice.js";
import { enrichTokens } from "./Services/marketDataService.js";
import "./App.css";


const NEW_TOKEN_DELAY = 10 * 60 * 1000;
const TOKEN_REFRESH_INTERVAL = 15000;

const navigation = [
  { id: "home", icon: "⌂", label: "Home" },
  { id: "feed", icon: "▤", label: "Feed" },
  { id: "explore", icon: "⌕", label: "Explore" },
  { id: "notifications", icon: "♧", label: "Notifications" },
  { id: "messages", icon: "✉", label: "Messages" },
  { id: "communities", icon: "◈", label: "Communities" },
  { id: "bookmarks", icon: "☆", label: "Saved" },
];

function Avatar({ letter, large = false }) {
  return (
    <div className={`tt-avatar ${large ? "large" : ""}`}>
      {letter || "T"}
    </div>
  );
}

function formatMoney(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) return "—";
  if (number >= 1_000_000_000) return `$${(number / 1_000_000_000).toFixed(2)}B`;
  if (number >= 1_000_000) return `$${(number / 1_000_000).toFixed(2)}M`;
  if (number >= 1_000) return `$${(number / 1_000).toFixed(2)}K`;

  return `$${number.toFixed(2)}`;
}

function formatPrice(value) {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) return "—";
  if (number < 0.000001) return `$${number.toExponential(2)}`;
  if (number < 0.01) return `$${number.toFixed(8)}`;
  if (number < 1) return `$${number.toFixed(6)}`;

  return `$${number.toFixed(2)}`;
}

function formatChange(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) return null;

  return `${number >= 0 ? "+" : ""}${number.toFixed(2)}%`;
}

function TokenCard({ token, index }) {
  const market = token.market || {};
  const image = token.imageUrl || market.imageUrl;
  const priceChange = formatChange(market.priceChange24h);

  return (
    <article className="tt-token-card">
      <div className="tt-token-card-top">
        <div className="tt-token-identity">
          {image ? (
            <img
              className="tt-token-image"
              src={image}
              alt={token.name || token.symbol || "Token"}
              loading="lazy"
              onError={(event) => {
                event.currentTarget.style.display = "none";
                const placeholder =
                  event.currentTarget.parentElement.querySelector(
                    ".tt-token-placeholder"
                  );

                if (placeholder) {
                  placeholder.style.display = "flex";
                }
              }}
            />
          ) : null}

          <div
            className="tt-token-placeholder"
            style={{ display: image ? "none" : "flex" }}
          >
            {token.symbol?.charAt(0) || "?"}
          </div>

          <div className="tt-token-name">
            <strong>{token.name || "Unknown Token"}</strong>
            <span>${token.symbol || "UNKNOWN"}</span>
          </div>
        </div>

        <span className="tt-token-rank">#{index + 1}</span>
      </div>

      <div className="tt-token-price">
        {formatPrice(market.priceUsd)}
      </div>

      <div className="tt-token-stats">
        <div>
          <span>Market cap</span>
          <strong>{formatMoney(market.marketCap)}</strong>
        </div>

        <div>
          <span>24h volume</span>
          <strong>{formatMoney(market.volume24h)}</strong>
        </div>

        <div>
          <span>Liquidity</span>
          <strong>{formatMoney(market.liquidity)}</strong>
        </div>

        <div>
          <span>24h change</span>
          <strong
            className={
              priceChange === null
                ? ""
                : Number(market.priceChange24h) >= 0
                  ? "positive"
                  : "negative"
            }
          >
            {priceChange || "—"}
          </strong>
        </div>
      </div>

      <div className="tt-token-card-footer">
        <span className="tt-token-protocol">
          {token.protocol || "Solana"}
        </span>

        {market.pairUrl ? (
          <a
            href={market.pairUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="tt-token-view"
          >
            View token ↗
          </a>
        ) : (
          <span className="tt-token-unavailable">
            Market unavailable
          </span>
        )}
      </div>
    </article>
  );
}

function EmptyState({ icon, title, description }) {
  return (
    <div className="tt-empty-feed">
      <div className="tt-empty-symbol">{icon}</div>
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [showLogin, setShowLogin] = useState(false);

  const [activePage, setActivePage] = useState("home");
  const [postText, setPostText] = useState("");
  const [search, setSearch] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  const [exploreTab, setExploreTab] = useState("trending");
  const [trendingTokens, setTrendingTokens] = useState([]);
  const [newTokens, setNewTokens] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [tokenConnected, setTokenConnected] = useState(false);
  const [clock, setClock] = useState(Date.now());

  // Firebase authentication.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        try {
          const snapshot = await getDoc(
            doc(db, "users", currentUser.uid)
          );

          setProfile(snapshot.exists() ? snapshot.data() : null);
        } catch (error) {
          console.error("Profile loading error:", error);
          setProfile(null);
        }
      } else {
        setProfile(null);
      }

      setAuthLoading(false);
    });

    return unsubscribe;
  }, []);

  // Live token services.
  useEffect(() => {
    const unsubscribeTrending = trendingService.subscribe((tokens) => {
      setTrendingTokens(tokens);
    });

    const unsubscribeNew = tokenService.subscribe(({ tokens, connected }) => {
      setNewTokens(tokens);
      setTokenConnected(connected);
    });

    trendingService.start();

    return () => {
      unsubscribeTrending();
      unsubscribeNew();
      trendingService.stop();
      tokenService.disconnect();
    };
  }, []);

  // Update the clock so tokens become visible after ten minutes
  // without needing a page refresh.
  useEffect(() => {
    const interval = setInterval(() => {
      setClock(Date.now());
    }, TOKEN_REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, []);

  // Search the entire stored token catalogue, including tokens
  // that have not yet reached the ten-minute display threshold.
  useEffect(() => {
    const term = search.trim();

    if (!term) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    let cancelled = false;

    const timer = setTimeout(async () => {
      setSearchLoading(true);

      try {
        const matches = await tokenService.searchTokens(term);
        const enriched = await enrichTokens(matches);

        if (!cancelled) {
          setSearchResults(enriched);
        }
      } catch (error) {
        console.error("Token search failed:", error);

        if (!cancelled) {
          setSearchResults([]);
        }
      } finally {
        if (!cancelled) {
          setSearchLoading(false);
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search]);

  const username =
    profile?.username ||
    user?.displayName ||
    user?.email?.split("@")[0] ||
    "member";

  const displayName = profile?.displayName || username;

  async function handleLogout() {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout error:", error);
    }
  }

  function navigate(page) {
    setActivePage(page);
    setMenuOpen(false);
  }

  function openPost() {
    setActivePage("feed");

    setTimeout(() => {
      document.querySelector(".tt-composer textarea")?.focus();
    }, 100);
  }

  function submitPost(event) {
    event.preventDefault();

    if (!postText.trim()) return;

    console.log("Post ready for submission:", postText.trim());
    setPostText("");

    alert(
      "Post publishing will be available when the feed database is connected."
    );
  }

  // The ten-minute delay affects the New tab display only.
  // All detected tokens remain in the search catalogue.
  const visibleNewTokens = useMemo(() => {
    return newTokens.filter((token) => {
      const detectedAt = Number(token.detectedAtMs || 0);

      return (
        detectedAt > 0 &&
        clock - detectedAt >= NEW_TOKEN_DELAY
      );
    });
  }, [newTokens, clock]);

  const filteredNewTokens = useMemo(() => {
    if (search.trim()) return searchResults;

    return visibleNewTokens;
  }, [search, searchResults, visibleNewTokens]);

  const filteredTrendingTokens = useMemo(() => {
    const source = search.trim() ? searchResults : trendingTokens;

    return [...source].sort((a, b) => {
      const volumeDifference =
        Number(b.market?.volume24h || 0) -
        Number(a.market?.volume24h || 0);

      if (volumeDifference !== 0) return volumeDifference;

      return (
        Number(b.market?.liquidity || 0) -
        Number(a.market?.liquidity || 0)
      );
    });
  }, [search, searchResults, trendingTokens]);

  if (authLoading) {
    return (
      <div className="tt-loading">
        <img src="/logo2.png" alt="TrenchTalk" />
        <span>LOADING TRENCHTALK</span>
      </div>
    );
  }

  // Public visitors see the countdown.
  // The admin passcode unlocks the login screen.
  if (!user) {
    return showLogin ? (
      <Login />
    ) : (
      <Countdown onLogin={() => setShowLogin(true)} />
    );
  }

  const pageTitles = {
    home: "Welcome to TrenchTalk",
    feed: "Your feed",
    explore: "Explore",
    notifications: "Notifications",
    messages: "Messages",
    communities: "Communities",
    bookmarks: "Saved posts",
    profile: "Your profile",
  };

  return (
    <div className="tt-dashboard">
      {/* SIDEBAR */}
      <aside className="tt-sidebar">
        <div className="tt-profile-area">
          <button
            className="tt-profile-button"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <Avatar letter={username[0]?.toUpperCase()} />

            <span className="tt-profile-details">
              <strong>{displayName}</strong>
              <small>@{username}</small>
            </span>

            <span className="tt-profile-more">···</span>
          </button>

          {menuOpen && (
            <div className="tt-profile-menu">
              <button onClick={() => navigate("profile")}>
                View profile
              </button>

              <button onClick={handleLogout}>
                Sign out
              </button>
            </div>
          )}
        </div>

        <button
          className="tt-brand"
          onClick={() => navigate("home")}
        >
          <img src="/logo2.png" alt="" />

          <span>
            TRENCH<span>TALK</span>
          </span>
        </button>

        <div className="tt-sidebar-divider" />

        <div className="tt-nav-heading">
          MENU
        </div>

        <nav className="tt-navigation">
          {navigation.map((item) => (
            <button
              key={item.id}
              className={`tt-nav-item ${
                activePage === item.id ? "active" : ""
              }`}
              onClick={() => navigate(item.id)}
            >
              <span className="tt-nav-icon">
                {item.icon}
              </span>

              <span className="tt-nav-label">
                {item.label}
              </span>
            </button>
          ))}
        </nav>

        <button
          className="tt-post-button"
          onClick={openPost}
        >
          <span>＋</span>
          Create a post
        </button>

        <div className="tt-sidebar-footer">
          <span className="tt-footer-dot" />
          <span>Community without limits.</span>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="tt-main">
        <header className="tt-topbar">
          <div className="tt-breadcrumb">
            <span>TrenchTalk</span>
            <span className="tt-breadcrumb-divider">/</span>
            <strong>{pageTitles[activePage]}</strong>
          </div>

          <div className="tt-topbar-right">
            <span className="tt-account-status">
              <span />
              Account active
            </span>
          </div>
        </header>

        <div className="tt-page">
          {/* HOME */}
          {activePage === "home" && (
            <section className="tt-home">
              <div className="tt-home-intro">
                <span className="tt-eyebrow">
                  YOUR COMMUNITY
                </span>

                <h1>
                  A place to <span>connect.</span>
                </h1>

                <p>
                  Welcome back, {displayName}.
                  Your communities, conversations and ideas all start here.
                </p>
              </div>

              <div className="tt-home-grid">
                <button
                  className="tt-home-card tt-home-card-primary"
                  onClick={() => navigate("feed")}
                >
                  <span className="tt-home-card-icon">▤</span>
                  <span className="tt-card-label">YOUR COMMUNITY</span>
                  <strong>Visit your feed</strong>
                  <p>
                    See what people are sharing and join the conversation.
                  </p>
                  <span className="tt-card-arrow">↗</span>
                </button>

                <button
                  className="tt-home-card"
                  onClick={() => navigate("explore")}
                >
                  <span className="tt-home-card-icon">⌕</span>
                  <span className="tt-card-label">DISCOVER</span>
                  <strong>Explore</strong>
                  <p>
                    Find new communities and discover what's happening.
                  </p>
                  <span className="tt-card-arrow">↗</span>
                </button>

                <button
                  className="tt-home-card"
                  onClick={() => navigate("communities")}
                >
                  <span className="tt-home-card-icon">◈</span>
                  <span className="tt-card-label">FIND YOUR PEOPLE</span>
                  <strong>Communities</strong>
                  <p>
                    Find people who share your interests.
                  </p>
                  <span className="tt-card-arrow">↗</span>
                </button>
              </div>

              <div className="tt-home-bottom">
                <div>
                  <span className="tt-home-bottom-icon">✳</span>

                  <div>
                    <strong>Welcome to TrenchTalk.</strong>
                    <p>
                      Your space to share, discover and connect.
                    </p>
                  </div>
                </div>

                <span className="tt-home-version">
                  TRENCHTALK BETA
                </span>
              </div>
            </section>
          )}

          {/* FEED */}
          {activePage === "feed" && (
            <section className="tt-feed">
              <div className="tt-page-heading">
                <div>
                  <span className="tt-eyebrow">YOUR COMMUNITY</span>
                  <h1>Your feed</h1>
                  <p>See what's happening across TrenchTalk.</p>
                </div>
              </div>

              <div className="tt-feed-tabs">
                <button className="selected">For you</button>
                <button>Following</button>
              </div>

              <form
                className="tt-composer"
                onSubmit={submitPost}
              >
                <div className="tt-composer-main">
                  <Avatar
                    letter={username[0]?.toUpperCase()}
                    large
                  />

                  <textarea
                    placeholder="What's happening?"
                    value={postText}
                    onChange={(event) => setPostText(event.target.value)}
                    maxLength={1000}
                  />
                </div>

                <div className="tt-composer-footer">
                  <span>{postText.length}/1000</span>

                  <button
                    type="submit"
                    disabled={!postText.trim()}
                  >
                    Post
                  </button>
                </div>
              </form>

              <EmptyState
                icon="◈"
                title="Nothing to see here yet."
                description="This is where posts from your community will appear. Check back later."
              />
            </section>
          )}

          {/* EXPLORE */}
          {activePage === "explore" && (
            <section className="tt-standard-page tt-explore">
              <div className="tt-page-heading">
                <div>
                  <span className="tt-eyebrow">
                    SOLANA TOKEN DISCOVERY
                  </span>

                  <h1>Explore</h1>

                  <p>
                    Discover emerging tokens and what's moving in the market.
                  </p>
                </div>
              </div>

              <label className="tt-search">
                <span>⌕</span>

                <input
                  type="search"
                  placeholder="Search tokens or paste a contract address..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>

              <div className="tt-market-header">
                <div>
                  <span className="tt-live-indicator" />
                  {tokenConnected ? "LIVE SOLANA DATA" : "CONNECTING TO SOLANA DATA"}
                </div>

                <span>
                  {search.trim()
                    ? `${searchResults.length} search results`
                    : exploreTab === "trending"
                      ? `${trendingTokens.length} trending tokens`
                      : `${visibleNewTokens.length} tokens available`}
                </span>
              </div>

              <div className="tt-market-tabs">
                <button
                  className={exploreTab === "trending" ? "selected" : ""}
                  onClick={() => setExploreTab("trending")}
                >
                  Trending
                </button>

                <button
                  className={exploreTab === "new" ? "selected" : ""}
                  onClick={() => setExploreTab("new")}
                >
                  New
                </button>
              </div>

              {searchLoading && (
                <div className="tt-search-status">
                  Searching the token catalogue...
                </div>
              )}

              {exploreTab === "trending" && (
                <div className="tt-token-grid">
                  {filteredTrendingTokens.map((token, index) => (
                    <TokenCard
                      key={token.mint}
                      token={token}
                      index={index}
                    />
                  ))}

                  {!searchLoading && filteredTrendingTokens.length === 0 && (
                    <EmptyState
                      icon="⌕"
                      title={
                        search.trim()
                          ? "No matching tokens found."
                          : "Building the trending leaderboard."
                      }
                      description={
                        search.trim()
                          ? "Try another name, ticker or contract address."
                          : "Tokens will appear here when market data becomes available. The leaderboard is ranked by 24-hour trading volume."
                      }
                    />
                  )}
                </div>
              )}

              {exploreTab === "new" && (
                <div className="tt-token-grid">
                  {filteredNewTokens.map((token, index) => (
                    <TokenCard
                      key={token.mint}
                      token={token}
                      index={index}
                    />
                  ))}

                  {!searchLoading && filteredNewTokens.length === 0 && (
                    <EmptyState
                      icon="◈"
                      title={
                        search.trim()
                          ? "No matching tokens found."
                          : "Waiting for new tokens."
                      }
                      description={
                        search.trim()
                          ? "Try another name, ticker or contract address. Search includes recently detected tokens too."
                          : "Newly detected tokens appear here after a ten-minute delay. They are searchable immediately after detection."
                      }
                    />
                  )}
                </div>
              )}
            </section>
          )}

          {/* COMMUNITIES */}
          {activePage === "communities" && (
            <section className="tt-standard-page">
              <div className="tt-page-heading">
                <div>
                  <span className="tt-eyebrow">FIND YOUR PEOPLE</span>
                  <h1>Communities</h1>
                  <p>Connect with people who share your interests.</p>
                </div>
              </div>

              <EmptyState
                icon="◈"
                title="No communities yet."
                description="Your communities will appear here."
              />
            </section>
          )}

          {/* MESSAGES */}
          {activePage === "messages" && (
            <section className="tt-standard-page">
              <div className="tt-page-heading">
                <div>
                  <span className="tt-eyebrow">YOUR CONVERSATIONS</span>
                  <h1>Messages</h1>
                  <p>Keep in touch with your community.</p>
                </div>
              </div>

              <EmptyState
                icon="✉"
                title="No messages yet."
                description="Your conversations will appear here."
              />
            </section>
          )}

          {/* NOTIFICATIONS */}
          {activePage === "notifications" && (
            <section className="tt-standard-page">
              <div className="tt-page-heading">
                <div>
                  <span className="tt-eyebrow">STAY UP TO DATE</span>
                  <h1>Notifications</h1>
                  <p>See what's happening around you.</p>
                </div>
              </div>

              <EmptyState
                icon="♧"
                title="You're all caught up."
                description="New notifications will appear here."
              />
            </section>
          )}

          {/* SAVED */}
          {activePage === "bookmarks" && (
            <section className="tt-standard-page">
              <div className="tt-page-heading">
                <div>
                  <span className="tt-eyebrow">KEEP WHAT MATTERS</span>
                  <h1>Saved posts</h1>
                  <p>Your bookmarked content.</p>
                </div>
              </div>

              <EmptyState
                icon="☆"
                title="No saved posts yet."
                description="Posts you save will appear here."
              />
            </section>
          )}

          {/* PROFILE */}
          {activePage === "profile" && (
            <section className="tt-standard-page">
              <div className="tt-page-heading">
                <div>
                  <span className="tt-eyebrow">YOUR ACCOUNT</span>
                  <h1>Your profile</h1>
                </div>
              </div>

              <div className="tt-profile-card">
                <Avatar
                  letter={username[0]?.toUpperCase()}
                  large
                />

                <div>
                  <h2>{displayName}</h2>
                  <p>@{username}</p>
                  <span>{user.email}</span>
                </div>
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;