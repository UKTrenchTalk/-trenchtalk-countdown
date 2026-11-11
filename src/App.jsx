import { useEffect, useState } from "react";

import {
  onAuthStateChanged,
  signOut,
  setPersistence,
  browserSessionPersistence,
} from "firebase/auth";

import { doc, getDoc } from "firebase/firestore";

import { auth, db } from "./firebase";
import Login from "./pages/login.jsx";
import Countdown from "./countdown.jsx";

import "./App.css";

// NAVIGATION

const navigation = [
  { id: "home", icon: "⌂", label: "Home" },
  { id: "explore", icon: "⌕", label: "Explore" },
  { id: "communities", icon: "◈", label: "Communities" },
  { id: "messages", icon: "✉", label: "Messages", count: "2" },
  { id: "notifications", icon: "♧", label: "Notifications", count: "3" },
  { id: "bookmarks", icon: "☆", label: "Bookmarks" },
];

// STARTING POSTS

const startingPosts = [
  {
    id: 1,
    user: "trenchtalk",
    name: "TrenchTalk Official",
    verified: true,
    time: "2 hours ago",
    community: "General",
    text: "Welcome to TrenchTalk. A place to discover communities, share ideas and connect with people who share your interests.",
    likes: 28,
    comments: 6,
    avatar: "T",
    liked: false,
    bookmarked: false,
  },
  {
    id: 2,
    user: "chainwatch",
    name: "Chain Watch",
    verified: false,
    time: "38 minutes ago",
    community: "Crypto",
    text: "What's everyone keeping an eye on today? Always interesting seeing what different communities are discussing.",
    likes: 14,
    comments: 9,
    avatar: "C",
    liked: false,
    bookmarked: false,
  },
  {
    id: 3,
    user: "solhunter",
    name: "Sol Hunter",
    verified: false,
    time: "12 minutes ago",
    community: "Crypto",
    text: "Reminder: do your own research, manage your risk and don't get caught chasing every green candle.",
    likes: 8,
    comments: 3,
    avatar: "S",
    liked: false,
    bookmarked: false,
  },
];

// COMMUNITIES

const communities = [
  {
    name: "TrenchTalk Official",
    category: "General discussion",
    members: "1.2k",
    icon: "T",
  },
  {
    name: "Crypto Trenches",
    category: "Cryptocurrency",
    members: "842",
    icon: "₿",
  },
  {
    name: "Gaming Hub",
    category: "Gaming",
    members: "516",
    icon: "G",
  },
];

// TRENDS

const trends = [
  { tag: "#Solana", posts: "1,284 posts" },
  { tag: "#Memecoins", posts: "956 posts" },
  { tag: "#Gaming", posts: "621 posts" },
  { tag: "#TrenchTalk", posts: "418 posts" },
];

// AVATAR

function Avatar({ letter, large = false }) {
  return (
    <div className={`tt-avatar ${large ? "tt-avatar-large" : ""}`}>
      {letter || "T"}
    </div>
  );
}

// MAIN APP

function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

  const [authLoading, setAuthLoading] = useState(true);

  const [showLogin, setShowLogin] = useState(false);

  const [activePage, setActivePage] = useState("home");

  const [posts, setPosts] = useState(startingPosts);
  const [postText, setPostText] = useState("");
  const [search, setSearch] = useState("");
  const [posting, setPosting] = useState(false);

  const [menuOpen, setMenuOpen] = useState(false);

  // FIREBASE SESSION AUTHENTICATION

  useEffect(() => {
    let unsubscribe;

    async function initialiseAuth() {
      try {
        await setPersistence(auth, browserSessionPersistence);

        unsubscribe = onAuthStateChanged(auth, async (currentUser) => {

          // Require admin access before accepting an existing session.
          const adminUnlocked =
            sessionStorage.getItem("tt-admin-unlocked") === "true";

          if (currentUser && !adminUnlocked) {
            await signOut(auth);

            setUser(null);
            setProfile(null);
            setShowLogin(false);
            setAuthLoading(false);

            return;
          }

          setUser(currentUser);

          if (currentUser) {
            try {
              const profileSnapshot = await getDoc(
                doc(db, "users", currentUser.uid)
              );

              setProfile(
                profileSnapshot.exists()
                  ? profileSnapshot.data()
                  : null
              );

            } catch (error) {
              console.error("Could not load user profile:", error);
              setProfile(null);
            }

          } else {
            setProfile(null);
          }

          setAuthLoading(false);
        });

      } catch (error) {
        console.error("Authentication initialisation failed:", error);
        setAuthLoading(false);
      }
    }

    initialiseAuth();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // USER DETAILS

  const username =
    profile?.username ||
    user?.displayName ||
    user?.email?.split("@")[0] ||
    "member";

  const displayName = username;

  // LOGOUT

  async function handleLogout() {
    try {
      sessionStorage.removeItem("tt-admin-unlocked");

      await signOut(auth);

      setShowLogin(false);
      setProfile(null);
      setActivePage("home");
      setMenuOpen(false);

    } catch (error) {
      console.error("Sign-out failed:", error);
    }
  }

  // CREATE POST

  function createPost(event) {
    event.preventDefault();

    const text = postText.trim();

    if (!text || posting) return;

    setPosting(true);

    const newPost = {
      id: Date.now(),
      user: username,
      name: displayName,
      verified: false,
      time: "Just now",
      community: "General",
      text,
      likes: 0,
      comments: 0,
      avatar: username[0]?.toUpperCase() || "T",
      liked: false,
      bookmarked: false,
    };

    setPosts((current) => [newPost, ...current]);

    setPostText("");
    setActivePage("home");
    setPosting(false);
  }

  // LIKE POST

  function toggleLike(postId) {
    setPosts((current) =>
      current.map((post) =>
        post.id === postId
          ? {
              ...post,
              liked: !post.liked,
              likes: post.likes + (post.liked ? -1 : 1),
            }
          : post
      )
    );
  }

  // BOOKMARK POST

  function toggleBookmark(postId) {
    setPosts((current) =>
      current.map((post) =>
        post.id === postId
          ? {
              ...post,
              bookmarked: !post.bookmarked,
            }
          : post
      )
    );
  }

  // FILTER POSTS

  const visiblePosts = posts.filter((post) => {
    if (activePage === "bookmarks") {
      return post.bookmarked;
    }

    if (activePage === "explore" && search.trim()) {
      const query = search.toLowerCase();

      return (
        post.text.toLowerCase().includes(query) ||
        post.user.toLowerCase().includes(query) ||
        post.community.toLowerCase().includes(query)
      );
    }

    return true;
  });

  // LOADING SCREEN

  if (authLoading) {
    return (
      <div className="tt-loading">
        <img src="/logo2.png" alt="TrenchTalk" />
        <span>LOADING TRENCHTALK</span>
      </div>
    );
  }

  // COUNTDOWN AND ADMIN ACCESS

  if (!user) {

    const adminUnlocked =
      sessionStorage.getItem("tt-admin-unlocked") === "true";

    if (showLogin && adminUnlocked) {
      return <Login />;
    }

    return (
      <Countdown
        onLogin={() => {
          if (
            sessionStorage.getItem("tt-admin-unlocked") === "true"
          ) {
            setShowLogin(true);
          }
        }}
      />
    );
  }

  // DASHBOARD

  return (
    <div className="tt-dashboard">

      {/* TOP BAR */}

      <header className="tt-topbar">

        <button
          className="tt-brand"
          onClick={() => setActivePage("home")}
        >
          <img src="/logo2.png" alt="TrenchTalk" />
          <span>
            TRENCH<span>TALK</span>
          </span>
        </button>

        <div className="tt-search">
          <span>⌕</span>

          <input
            type="search"
            placeholder="Search TrenchTalk..."
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setActivePage("explore");
            }}
          />

          <kbd>CTRL K</kbd>
        </div>

        <div className="tt-top-actions">

          <div className="tt-beta">
            <span />
            BETA
          </div>

          <button
            className="tt-top-avatar"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {username[0]?.toUpperCase() || "T"}
          </button>

          {menuOpen && (
            <div className="tt-account-menu">

              <strong>@{username}</strong>

              <button
                onClick={() => {
                  setActivePage("profile");
                  setMenuOpen(false);
                }}
              >
                View profile
              </button>

              <button onClick={handleLogout}>
                Sign out
              </button>

            </div>
          )}

        </div>

      </header>

      {/* DASHBOARD LAYOUT */}

      <div className="tt-dashboard-layout">

        {/* LEFT SIDEBAR */}

        <aside className="tt-left-sidebar">

          <div className="tt-sidebar-label">
            MENU
          </div>

          <nav className="tt-navigation">

            {navigation.map((item) => (
              <button
                key={item.id}
                className={`tt-nav-item ${
                  activePage === item.id ? "active" : ""
                }`}
                onClick={() => {
                  setActivePage(item.id);
                  setSearch("");
                }}
              >

                <span className="tt-nav-icon">
                  {item.icon}
                </span>

                <span>{item.label}</span>

                {item.count && (
                  <span className="tt-nav-count">
                    {item.count}
                  </span>
                )}

              </button>
            ))}

          </nav>

          <div className="tt-sidebar-divider" />

          <div className="tt-sidebar-label">
            YOUR COMMUNITIES
          </div>

          <div className="tt-sidebar-communities">

            {communities.map((community) => (
              <button
                className="tt-community-shortcut"
                key={community.name}
                onClick={() => setActivePage("communities")}
              >

                <span className="tt-community-icon">
                  {community.icon}
                </span>

                <span>{community.name}</span>

              </button>
            ))}

          </div>

          <button
            className="tt-create-community"
            onClick={() => setActivePage("communities")}
          >
            <span>＋</span> Create community
          </button>

          <div className="tt-sidebar-account">

            <Avatar letter={username[0]?.toUpperCase()} />

            <div className="tt-account-info">
              <strong>{displayName}</strong>
              <span>@{username}</span>
            </div>

            <button
              className="tt-account-dots"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              ···
            </button>

          </div>

        </aside>

        {/* MAIN FEED */}

        <main className="tt-main-feed">

          <div className="tt-feed-heading">

            <div>

              <div className="tt-eyebrow">
                YOUR COMMUNITY
              </div>

              <h1>
                {activePage === "home"
                  ? "Your feed"
                  : activePage === "explore"
                    ? "Explore"
                    : activePage === "communities"
                      ? "Communities"
                      : activePage === "messages"
                        ? "Messages"
                        : activePage === "notifications"
                          ? "Notifications"
                          : activePage === "bookmarks"
                            ? "Saved posts"
                            : "Your profile"}
              </h1>

              <p>
                {activePage === "home"
                  ? "See what's happening across TrenchTalk."
                  : "Discover what's happening in the community."}
              </p>

            </div>

            <span className="tt-feed-status">
              <span /> LIVE COMMUNITY
            </span>

          </div>

          {/* FEED TABS */}

          {activePage === "home" && (
            <div className="tt-feed-tabs">

              <button className="selected">
                For you
              </button>

              <button onClick={() => setActivePage("communities")}>
                Following
              </button>

            </div>
          )}

          {/* POST COMPOSER */}

          {activePage === "home" && (
            <form
              className="tt-composer"
              onSubmit={createPost}
            >

              <div className="tt-composer-top">

                <Avatar
                  letter={username[0]?.toUpperCase()}
                  large
                />

                <textarea
                  placeholder="What's happening in your community?"
                  value={postText}
                  onChange={(event) => setPostText(event.target.value)}
                  maxLength={1000}
                />

              </div>

              <div className="tt-composer-bottom">

                <span>
                  {postText.length}/1000
                </span>

                <button
                  type="submit"
                  disabled={!postText.trim() || posting}
                >
                  {posting ? "POSTING..." : "PUBLISH POST ↗"}
                </button>

              </div>

            </form>
          )}

          {/* COMMUNITIES */}

          {activePage === "communities" && (
            <section className="tt-community-directory">

              <div className="tt-section-heading">
                <h2>Discover communities</h2>
                <span>Find your people.</span>
              </div>

              {communities.map((community) => (
                <article
                  className="tt-directory-card"
                  key={community.name}
                >

                  <div className="tt-directory-icon">
                    {community.icon}
                  </div>

                  <div>
                    <strong>{community.name}</strong>

                    <span>
                      {community.category} · {community.members} members
                    </span>
                  </div>

                  <button>
                    Explore ↗
                  </button>

                </article>
              ))}

            </section>
          )}

          {/* MESSAGES */}

          {activePage === "messages" && (
            <div className="tt-empty-state">
              <span>✉</span>
              <h2>Your conversations will appear here.</h2>
              <p>Direct messaging is coming in the next development stage.</p>
            </div>
          )}

          {/* NOTIFICATIONS */}

          {activePage === "notifications" && (
            <div className="tt-empty-state">
              <span>♧</span>
              <h2>You're all caught up.</h2>
              <p>New activity and notifications will appear here.</p>
            </div>
          )}

          {/* PROFILE */}

          {activePage === "profile" && (
            <section className="tt-profile-card">

              <Avatar
                letter={username[0]?.toUpperCase()}
                large
              />

              <div>
                <h2>{displayName}</h2>
                <p>@{username}</p>
                <span>{user.email}</span>
              </div>

            </section>
          )}

          {/* POSTS */}

          {(activePage === "home" ||
            activePage === "explore" ||
            activePage === "bookmarks") && (

            <section className="tt-post-list">

              {visiblePosts.length === 0 ? (

                <div className="tt-empty-state">
                  <span>☆</span>
                  <h2>Nothing here yet.</h2>
                  <p>Posts you save will appear here.</p>
                </div>

              ) : (

                visiblePosts.map((post) => (

                  <article
                    className="tt-post"
                    key={post.id}
                  >

                    <Avatar
                      letter={post.avatar}
                      large
                    />

                    <div className="tt-post-content">

                      <div className="tt-post-header">

                        <div className="tt-post-author">

                          <strong>{post.name}</strong>

                          {post.verified && (
                            <span className="tt-verified">
                              ✓
                            </span>
                          )}

                          <span>@{post.user}</span>
                          <i>·</i>
                          <span>{post.time}</span>

                        </div>

                        <button className="tt-post-more">
                          ···
                        </button>

                      </div>

                      <div className="tt-post-community">
                        IN {post.community.toUpperCase()}
                      </div>

                      <p className="tt-post-text">
                        {post.text}
                      </p>

                      <div className="tt-post-actions">

                        <button>
                          <span>▢</span> {post.comments}
                        </button>

                        <button
                          className={post.liked ? "liked" : ""}
                          onClick={() => toggleLike(post.id)}
                        >
                          <span>♡</span> {post.likes}
                        </button>

                        <button>
                          <span>↗</span> Share
                        </button>

                        <button
                          className={`tt-bookmark ${
                            post.bookmarked ? "saved" : ""
                          }`}
                          onClick={() => toggleBookmark(post.id)}
                        >
                          {post.bookmarked ? "★" : "☆"}
                        </button>

                      </div>

                    </div>

                  </article>

                ))

              )}

            </section>

          )}

        </main>

        {/* RIGHT SIDEBAR */}

        <aside className="tt-right-sidebar">

          {/* TRENDING */}

          <section className="tt-right-section">

            <div className="tt-right-heading">
              <h3>Trending topics</h3>
              <span>LIVE</span>
            </div>

            {trends.map((trend, index) => (
              <button
                className="tt-trend"
                key={trend.tag}
                onClick={() => {
                  setSearch(trend.tag.replace("#", ""));
                  setActivePage("explore");
                }}
              >

                <span className="tt-trend-rank">
                  0{index + 1}
                </span>

                <span>
                  <strong>{trend.tag}</strong>
                  <small>{trend.posts}</small>
                </span>

                <b>↗</b>

              </button>
            ))}

          </section>

          {/* SUGGESTED COMMUNITIES */}

          <section className="tt-right-section">

            <div className="tt-right-heading">

              <h3>Suggested communities</h3>

              <button onClick={() => setActivePage("communities")}>
                VIEW ALL
              </button>

            </div>

            {communities.map((community) => (
              <div
                className="tt-suggested"
                key={community.name}
              >

                <div className="tt-suggested-icon">
                  {community.icon}
                </div>

                <div>
                  <strong>{community.name}</strong>
                  <span>{community.members} members</span>
                </div>

                <button
                  title="Explore community"
                  onClick={() => setActivePage("communities")}
                >
                  +
                </button>

              </div>
            ))}

          </section>

          {/* FOOTER */}

          <div className="tt-right-footer">
            <strong>TRENCHTALK</strong>
            <span>Community without limits.</span>
            <p>© {new Date().getFullYear()} TrenchTalk</p>
          </div>

        </aside>

      </div>

    </div>
  );
}

export default App;