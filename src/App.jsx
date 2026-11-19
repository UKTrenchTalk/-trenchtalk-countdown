import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import Login from "./pages/login.jsx";
import "./App.css";

const navigation = [
  { id: "home", icon: "⌂", label: "Home" },
  { id: "explore", icon: "⌕", label: "Explore" },
  { id: "notifications", icon: "♧", label: "Notifications", count: "3" },
  { id: "messages", icon: "✉", label: "Messages", count: "2" },
  { id: "communities", icon: "◈", label: "Communities" },
  { id: "bookmarks", icon: "☆", label: "Saved" },
];

const startingPosts = [
  {
    id: 1,
    user: "trenchtalk",
    name: "TrenchTalk Official",
    verified: true,
    time: "2 hours ago",
    community: "General",
    text: "Welcome to TrenchTalk. A place to discover communities, share ideas and connect with people who share their interests.",
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

const trends = [
  { tag: "#Solana", posts: "1,284 posts" },
  { tag: "#Memecoins", posts: "956 posts" },
  { tag: "#Gaming", posts: "621 posts" },
  { tag: "#TrenchTalk", posts: "418 posts" },
];

function Avatar({ letter, large = false }) {
  return (
    <div className={`tt-avatar ${large ? "tt-avatar-large" : ""}`}>
      {letter || "T"}
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [activePage, setActivePage] = useState("home");
  const [posts, setPosts] = useState(startingPosts);
  const [postText, setPostText] = useState("");
  const [search, setSearch] = useState("");
  const [posting, setPosting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        try {
          const profileSnapshot = await getDoc(
            doc(db, "users", currentUser.uid)
          );

          setProfile(
            profileSnapshot.exists() ? profileSnapshot.data() : null
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

    return unsubscribe;
  }, []);

  const username =
    profile?.username ||
    user?.displayName ||
    user?.email?.split("@")[0] ||
    "member";

  const displayName = profile?.displayName || username;

  async function handleLogout() {
    try {
      await signOut(auth);
      setMenuOpen(false);
    } catch (error) {
      console.error("Sign-out failed:", error);
    }
  }

  function changePage(page) {
    setActivePage(page);

    if (page !== "explore") {
      setSearch("");
    }

    setMenuOpen(false);
  }

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

  function toggleBookmark(postId) {
    setPosts((current) =>
      current.map((post) =>
        post.id === postId
          ? { ...post, bookmarked: !post.bookmarked }
          : post
      )
    );
  }

  const visiblePosts = posts.filter((post) => {
    if (activePage === "bookmarks") {
      return post.bookmarked;
    }

    if (activePage === "explore" && search.trim()) {
      const query = search.toLowerCase();

      return (
        post.text.toLowerCase().includes(query) ||
        post.user.toLowerCase().includes(query) ||
        post.community.toLowerCase().includes(query) ||
        post.name.toLowerCase().includes(query)
      );
    }

    return true;
  });

  const pageTitle = {
    home: "Your feed",
    explore: "Explore",
    communities: "Communities",
    messages: "Messages",
    notifications: "Notifications",
    bookmarks: "Saved posts",
    profile: "Your profile",
  }[activePage] || "Your feed";

  if (authLoading) {
    return (
      <div className="tt-loading">
        <img src="/logo2.png" alt="TrenchTalk" />
        <span>LOADING TRENCHTALK</span>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="tt-dashboard">

      {/* LEFT NAVIGATION */}

      <aside className="tt-left-sidebar">

        <button
          className="tt-brand"
          onClick={() => changePage("home")}
          aria-label="TrenchTalk home"
        >
          <img src="/logo2.png" alt="" />
          <span>
            TRENCH<span>TALK</span>
          </span>
        </button>

        <nav className="tt-sidebar-nav">
          {navigation.map((item) => (
            <button
              key={item.id}
              className={`tt-nav-item ${
                activePage === item.id ? "active" : ""
              }`}
              onClick={() => changePage(item.id)}
            >
              <span className="tt-nav-icon">{item.icon}</span>

              <span className="tt-nav-label">
                {item.label}
              </span>

              {item.count && (
                <span className="tt-nav-count">
                  {item.count}
                </span>
              )}
            </button>
          ))}
        </nav>

        <button
          className="tt-compose-sidebar"
          onClick={() => {
            changePage("home");
            setTimeout(() => {
              document.querySelector(".tt-composer textarea")?.focus();
            }, 50);
          }}
        >
          <span>＋</span>
          <span>Post</span>
        </button>

        <div className="tt-sidebar-bottom">
          <button
            className="tt-user-card"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <Avatar letter={username[0]?.toUpperCase()} />

            <span>
              <strong>{displayName}</strong>
              <small>@{username}</small>
            </span>

            <b>···</b>
          </button>

          {menuOpen && (
            <div className="tt-account-menu">
              <button onClick={() => changePage("profile")}>
                View profile
              </button>

              <button onClick={handleLogout}>
                Sign out
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* CENTRE AND RIGHT CONTENT */}

      <div className="tt-content-layout">

        <main className="tt-main-feed">

          {/* MOBILE HEADER */}

          <header className="tt-mobile-header">
            <img src="/logo2.png" alt="" />
            <strong>TRENCH<span>TALK</span></strong>
          </header>

          {/* FEED HEADER */}

          <div className="tt-feed-heading">
            <div>
              <div className="tt-eyebrow">YOUR COMMUNITY</div>
              <h1>{pageTitle}</h1>
              <p>
                {activePage === "home"
                  ? "See what's happening across TrenchTalk."
                  : activePage === "explore"
                    ? "Find conversations, people and ideas."
                    : "Discover what's happening in the community."}
              </p>
            </div>

            <span className="tt-feed-status">
              <span />
              LIVE
            </span>
          </div>

          {/* HOME FEED */}

          {activePage === "home" && (
            <>
              <div className="tt-feed-tabs">
                <button className="selected">For you</button>
                <button onClick={() => changePage("communities")}>
                  Following
                </button>
              </div>

              <form className="tt-composer" onSubmit={createPost}>
                <div className="tt-composer-top">
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

                <div className="tt-composer-bottom">
                  <span>{postText.length}/1000</span>

                  <button
                    type="submit"
                    disabled={!postText.trim() || posting}
                  >
                    {posting ? "POSTING..." : "POST"}
                  </button>
                </div>
              </form>
            </>
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

                  <button type="button">
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
              <p>
                Direct messaging is coming in the next development stage.
              </p>
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

                  <h2>
                    {activePage === "bookmarks"
                      ? "No saved posts yet."
                      : "No posts found."}
                  </h2>

                  <p>
                    {activePage === "bookmarks"
                      ? "Posts you save will appear here."
                      : "Try another search term."}
                  </p>
                </div>
              ) : (
                visiblePosts.map((post) => (
                  <article className="tt-post" key={post.id}>
                    <Avatar letter={post.avatar} large />

                    <div className="tt-post-content">

                      <div className="tt-post-header">
                        <div className="tt-post-author">
                          <strong>{post.name}</strong>

                          {post.verified && (
                            <span className="tt-verified">✓</span>
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
                        <button type="button">
                          <span>▢</span>
                          {post.comments}
                        </button>

                        <button
                          type="button"
                          className={post.liked ? "liked" : ""}
                          onClick={() => toggleLike(post.id)}
                        >
                          <span>
                            {post.liked ? "♥" : "♡"}
                          </span>
                          {post.likes}
                        </button>

                        <button type="button">
                          <span>↗</span>
                          Share
                        </button>

                        <button
                          type="button"
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

          <label className="tt-search">
            <span>⌕</span>

            <input
              type="search"
              placeholder="Search TrenchTalk"
              value={search}
              onFocus={() => setActivePage("explore")}
              onChange={(event) => {
                setSearch(event.target.value);
                setActivePage("explore");
              }}
            />
          </label>

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

          <section className="tt-right-section">
            <div className="tt-right-heading">
              <h3>Suggested communities</h3>

              <button onClick={() => changePage("communities")}>
                VIEW ALL
              </button>
            </div>

            {communities.map((community) => (
              <div className="tt-suggested" key={community.name}>
                <div className="tt-suggested-icon">
                  {community.icon}
                </div>

                <div>
                  <strong>{community.name}</strong>
                  <span>{community.members} members</span>
                </div>

                <button
                  onClick={() => changePage("communities")}
                >
                  +
                </button>
              </div>
            ))}
          </section>

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