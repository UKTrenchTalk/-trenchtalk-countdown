import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import Login from "./pages/login.jsx";
import "./App.css";

const communities = [
  { name: "TrenchTalk Official", category: "General discussion", members: "1.2k", icon: "T", color: "#17291C" },
  { name: "Crypto Trenches", category: "Cryptocurrency", members: "842", icon: "₿", color: "#304B32" },
  { name: "Gaming Hub", category: "Gaming", members: "516", icon: "G", color: "#526B45" },
];

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

const trends = [
  { tag: "#Solana", posts: "1,284 posts" },
  { tag: "#Memecoins", posts: "956 posts" },
  { tag: "#Gaming", posts: "621 posts" },
  { tag: "#TrenchTalk", posts: "418 posts" },
];

const navigation = [
  { id: "home", icon: "⌂", label: "Home" },
  { id: "feed", icon: "▤", label: "Social feed" },
  { id: "explore", icon: "⌕", label: "Explore" },
  { id: "communities", icon: "◈", label: "Communities" },
  { id: "messages", icon: "✉", label: "Messages", count: "2" },
  { id: "notifications", icon: "♧", label: "Notifications", count: "3" },
  { id: "bookmarks", icon: "☆", label: "Saved posts" },
];

const channels = [
  { name: "general", icon: "#" },
  { name: "announcements", icon: "#" },
  { name: "introductions", icon: "#" },
  { name: "community-chat", icon: "#" },
];

const cryptoChannels = [
  { name: "general", icon: "#" },
  { name: "market-discussion", icon: "#" },
  { name: "memecoins", icon: "#" },
  { name: "trading-chat", icon: "#" },
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
  const [activeCommunity, setActiveCommunity] = useState(0);
  const [activeChannel, setActiveChannel] = useState("general");

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

  async function handleLogout() {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Sign-out failed:", error);
    }
  }

  function navigate(page) {
    setActivePage(page);
    setSearch("");
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
      name: username,
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
    navigate("feed");
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
    if (activePage === "bookmarks") return post.bookmarked;

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

  if (authLoading) {
    return (
      <div className="tt-loading">
        <img src="/logo2.png" alt="TrenchTalk" />
        <span>LOADING TRENCHTALK</span>
      </div>
    );
  }

  if (!user) return <Login />;

  return (
    <div className="tt-dashboard tt-redesign">
      <header className="tt-topbar">
        <button className="tt-brand" onClick={() => navigate("home")}>
          <img src="/logo2.png" alt="TrenchTalk" />
          <span>TRENCH<span>TALK</span></span>
        </button>

        <div className="tt-search">
          <span>⌕</span>
          <input
            type="search"
            placeholder="Search TrenchTalk..."
            value={search}
            onFocus={() => setActivePage("explore")}
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
              <button onClick={() => navigate("profile")}>
                View profile
              </button>
              <button onClick={handleLogout}>
                Sign out
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="tt-workspace">

        {/* DISCORD-STYLE SERVER RAIL */}
        <aside className="tt-server-rail">
          <button
            className={`tt-server-home ${activePage === "home" ? "active" : ""}`}
            onClick={() => navigate("home")}
            title="Home"
          >
            <img src="/logo2.png" alt="TrenchTalk" />
          </button>

          <div className="tt-rail-divider" />

          {communities.map((community, index) => (
            <button
              key={community.name}
              title={community.name}
              className={`tt-server-icon ${activeCommunity === index && activePage === "community" ? "active" : ""}`}
              style={{ "--community-color": community.color }}
              onClick={() => {
                setActiveCommunity(index);
                setActivePage("community");
                setActiveChannel("general");
              }}
            >
              {community.icon}
            </button>
          ))}

          <button
            className="tt-server-add"
            title="Discover communities"
            onClick={() => navigate("communities")}
          >
            +
          </button>

          <button
            className="tt-server-discover"
            title="Explore"
            onClick={() => navigate("explore")}
          >
            ◈
          </button>
        </aside>

        {/* CHANNEL AND NAVIGATION PANEL */}
        <aside className="tt-channel-sidebar">
          <div className="tt-channel-brand">
            <div className="tt-channel-brand-name">
              TRENCH<span>TALK</span>
            </div>
            <div className="tt-channel-brand-subtitle">
              YOUR COMMUNITY NETWORK
            </div>
          </div>

          <div className="tt-sidebar-label">PLATFORM</div>

          <nav className="tt-navigation">
            {navigation.map((item) => (
              <button
                key={item.id}
                className={`tt-nav-item ${activePage === item.id ? "active" : ""}`}
                onClick={() => navigate(item.id)}
              >
                <span className="tt-nav-icon">{item.icon}</span>
                <span>{item.label}</span>
                {item.count && (
                  <span className="tt-nav-count">{item.count}</span>
                )}
              </button>
            ))}
          </nav>

          <div className="tt-sidebar-divider" />

          {activePage === "community" ? (
            <>
              <div className="tt-community-sidebar-heading">
                <span>{communities[activeCommunity].name}</span>
                <span>⌄</span>
              </div>

              <div className="tt-sidebar-label">TEXT CHANNELS</div>

              <div className="tt-channel-list">
                {(activeCommunity === 1 ? cryptoChannels : channels).map((channel) => (
                  <button
                    key={channel.name}
                    className={`tt-channel-item ${activeChannel === channel.name ? "active" : ""}`}
                    onClick={() => setActiveChannel(channel.name)}
                  >
                    <span>{channel.icon}</span>
                    {channel.name}
                  </button>
                ))}
              </div>

              <button
                className="tt-create-community"
                onClick={() => navigate("communities")}
              >
                + Explore communities
              </button>
            </>
          ) : (
            <>
              <div className="tt-sidebar-label">YOUR COMMUNITIES</div>

              <div className="tt-sidebar-communities">
                {communities.map((community, index) => (
                  <button
                    className="tt-community-shortcut"
                    key={community.name}
                    onClick={() => {
                      setActiveCommunity(index);
                      setActivePage("community");
                      setActiveChannel("general");
                    }}
                  >
                    <span
                      className="tt-community-icon"
                      style={{ background: community.color }}
                    >
                      {community.icon}
                    </span>
                    <span>{community.name}</span>
                  </button>
                ))}
              </div>

              <button
                className="tt-create-community"
                onClick={() => navigate("communities")}
              >
                + Discover communities
              </button>
            </>
          )}

          <div className="tt-sidebar-account">
            <Avatar letter={username[0]?.toUpperCase()} />
            <div className="tt-account-info">
              <strong>{username}</strong>
              <span>Online</span>
            </div>
            <button
              className="tt-account-dots"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              ···
            </button>
          </div>
        </aside>

        {/* MAIN WORKSPACE */}
        <main className="tt-main-feed">

          {activePage === "home" && (
            <>
              <div className="tt-workspace-heading">
                <div>
                  <div className="tt-eyebrow">YOUR NETWORK</div>
                  <h1>Welcome back, {username}.</h1>
                  <p>Your communities, conversations and activity in one place.</p>
                </div>
                <span className="tt-feed-status"><span /> ONLINE</span>
              </div>

              <section className="tt-home-welcome">
                <div>
                  <div className="tt-eyebrow">TRENCHTALK COMMUNITY NETWORK</div>
                  <h2>Find your people.<br />Join the conversation.</h2>
                  <p>Explore communities, discover discussions and connect with people who share your interests.</p>
                  <button onClick={() => navigate("explore")}>
                    EXPLORE TRENCHTALK ↗
                  </button>
                </div>
                <div className="tt-home-mark">T</div>
              </section>

              <div className="tt-home-section-heading">
                <div>
                  <h2>Your communities</h2>
                  <span>Jump back into a conversation.</span>
                </div>
                <button onClick={() => navigate("communities")}>VIEW ALL ↗</button>
              </div>

              <div className="tt-home-community-grid">
                {communities.map((community, index) => (
                  <button
                    className="tt-home-community-card"
                    key={community.name}
                    onClick={() => {
                      setActiveCommunity(index);
                      setActivePage("community");
                    }}
                  >
                    <span
                      className="tt-home-community-icon"
                      style={{ background: community.color }}
                    >
                      {community.icon}
                    </span>
                    <strong>{community.name}</strong>
                    <small>{community.members} members</small>
                    <span className="tt-home-community-arrow">↗</span>
                  </button>
                ))}
              </div>

              <div className="tt-home-section-heading">
                <div>
                  <h2>Recent activity</h2>
                  <span>What's happening across your network.</span>
                </div>
                <button onClick={() => navigate("feed")}>OPEN FEED ↗</button>
              </div>

              <section className="tt-post-list">
                {posts.slice(0, 2).map((post) => (
                  <article className="tt-post" key={post.id}>
                    <Avatar letter={post.avatar} large />
                    <div className="tt-post-content">
                      <div className="tt-post-header">
                        <div className="tt-post-author">
                          <strong>{post.name}</strong>
                          {post.verified && <span className="tt-verified">✓</span>}
                          <span>@{post.user}</span>
                          <i>·</i>
                          <span>{post.time}</span>
                        </div>
                      </div>
                      <div className="tt-post-community">IN {post.community.toUpperCase()}</div>
                      <p className="tt-post-text">{post.text}</p>
                      <div className="tt-post-actions">
                        <button onClick={() => navigate("feed")}>▢ {post.comments}</button>
                        <button className={post.liked ? "liked" : ""} onClick={() => toggleLike(post.id)}>
                          ♡ {post.likes}
                        </button>
                        <button onClick={() => navigate("feed")}>↗ Share</button>
                        <button className={`tt-bookmark ${post.bookmarked ? "saved" : ""}`} onClick={() => toggleBookmark(post.id)}>
                          {post.bookmarked ? "★" : "☆"}
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </section>
            </>
          )}

          {activePage === "feed" && (
            <>
              <div className="tt-workspace-heading">
                <div>
                  <div className="tt-eyebrow">THE SOCIAL NETWORK</div>
                  <h1>Your feed</h1>
                  <p>See what's happening across TrenchTalk.</p>
                </div>
                <span className="tt-feed-status"><span /> LIVE COMMUNITY</span>
              </div>

              <div className="tt-feed-tabs">
                <button className="selected">For you</button>
                <button>Following</button>
              </div>

              <form className="tt-composer" onSubmit={createPost}>
                <div className="tt-composer-top">
                  <Avatar letter={username[0]?.toUpperCase()} large />
                  <textarea
                    placeholder="What's happening in your community?"
                    value={postText}
                    onChange={(event) => setPostText(event.target.value)}
                    maxLength={1000}
                  />
                </div>
                <div className="tt-composer-bottom">
                  <span>{postText.length}/1000</span>
                  <button type="submit" disabled={!postText.trim() || posting}>
                    {posting ? "POSTING..." : "PUBLISH POST ↗"}
                  </button>
                </div>
              </form>

              <section className="tt-post-list">
                {posts.map((post) => (
                  <article className="tt-post" key={post.id}>
                    <Avatar letter={post.avatar} large />
                    <div className="tt-post-content">
                      <div className="tt-post-header">
                        <div className="tt-post-author">
                          <strong>{post.name}</strong>
                          {post.verified && <span className="tt-verified">✓</span>}
                          <span>@{post.user}</span>
                          <i>·</i>
                          <span>{post.time}</span>
                        </div>
                        <button className="tt-post-more">···</button>
                      </div>
                      <div className="tt-post-community">IN {post.community.toUpperCase()}</div>
                      <p className="tt-post-text">{post.text}</p>
                      <div className="tt-post-actions">
                        <button>▢ {post.comments}</button>
                        <button className={post.liked ? "liked" : ""} onClick={() => toggleLike(post.id)}>
                          ♡ {post.likes}
                        </button>
                        <button>↗ Share</button>
                        <button className={`tt-bookmark ${post.bookmarked ? "saved" : ""}`} onClick={() => toggleBookmark(post.id)}>
                          {post.bookmarked ? "★" : "☆"}
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </section>
            </>
          )}

          {activePage === "community" && (
            <>
              <div className="tt-workspace-heading">
                <div>
                  <div className="tt-eyebrow">COMMUNITY CHANNEL</div>
                  <h1>{communities[activeCommunity].name}</h1>
                  <p>#{activeChannel} · {communities[activeCommunity].category}</p>
                </div>
                <span className="tt-feed-status"><span /> COMMUNITY</span>
              </div>

              <div className="tt-community-placeholder">
                <div className="tt-community-placeholder-icon">
                  {communities[activeCommunity].icon}
                </div>
                <h2>Welcome to {communities[activeCommunity].name}</h2>
                <p>This is the beginning of the #{activeChannel} channel.</p>
                <span>Community chat functionality will be connected in a later development stage.</span>
              </div>
            </>
          )}

          {activePage === "explore" && (
            <>
              <div className="tt-workspace-heading">
                <div>
                  <div className="tt-eyebrow">DISCOVER SOMETHING NEW</div>
                  <h1>Explore</h1>
                  <p>Find conversations, communities and people.</p>
                </div>
              </div>

              {!search.trim() ? (
                <>
                  <section className="tt-explore-section">
                    <div className="tt-home-section-heading">
                      <div>
                        <h2>Trending topics</h2>
                        <span>Conversations happening right now.</span>
                      </div>
                    </div>
                    <div className="tt-explore-trends">
                      {trends.map((trend, index) => (
                        <button
                          key={trend.tag}
                          onClick={() => setSearch(trend.tag.replace("#", ""))}
                        >
                          <span>0{index + 1}</span>
                          <strong>{trend.tag}</strong>
                          <small>{trend.posts}</small>
                          <b>↗</b>
                        </button>
                      ))}
                    </div>
                  </section>

                  <section className="tt-explore-section">
                    <div className="tt-home-section-heading">
                      <div>
                        <h2>Popular communities</h2>
                        <span>Find somewhere to belong.</span>
                      </div>
                    </div>
                    <div className="tt-home-community-grid">
                      {communities.map((community, index) => (
                        <button
                          className="tt-home-community-card"
                          key={community.name}
                          onClick={() => {
                            setActiveCommunity(index);
                            setActivePage("community");
                          }}
                        >
                          <span className="tt-home-community-icon" style={{ background: community.color }}>
                            {community.icon}
                          </span>
                          <strong>{community.name}</strong>
                          <small>{community.members} members</small>
                          <span className="tt-home-community-arrow">↗</span>
                        </button>
                      ))}
                    </div>
                  </section>
                </>
              ) : (
                <section className="tt-post-list">
                  <div className="tt-home-section-heading">
                    <div>
                      <h2>Search results</h2>
                      <span>Showing posts matching "{search}".</span>
                    </div>
                    <button onClick={() => setSearch("")}>CLEAR SEARCH ×</button>
                  </div>

                  {visiblePosts.length === 0 ? (
                    <div className="tt-empty-state">
                      <span>⌕</span>
                      <h2>No results found.</h2>
                      <p>Try another search term.</p>
                    </div>
                  ) : (
                    visiblePosts.map((post) => (
                      <article className="tt-post" key={post.id}>
                        <Avatar letter={post.avatar} large />
                        <div className="tt-post-content">
                          <div className="tt-post-header">
                            <div className="tt-post-author">
                              <strong>{post.name}</strong>
                              {post.verified && <span className="tt-verified">✓</span>}
                              <span>@{post.user}</span>
                              <i>·</i>
                              <span>{post.time}</span>
                            </div>
                          </div>
                          <div className="tt-post-community">IN {post.community.toUpperCase()}</div>
                          <p className="tt-post-text">{post.text}</p>
                          <div className="tt-post-actions">
                            <button>▢ {post.comments}</button>
                            <button className={post.liked ? "liked" : ""} onClick={() => toggleLike(post.id)}>♡ {post.likes}</button>
                            <button>↗ Share</button>
                            <button className={`tt-bookmark ${post.bookmarked ? "saved" : ""}`} onClick={() => toggleBookmark(post.id)}>
                              {post.bookmarked ? "★" : "☆"}
                            </button>
                          </div>
                        </div>
                      </article>
                    ))
                  )}
                </section>
              )}
            </>
          )}

          {activePage === "communities" && (
            <>
              <div className="tt-workspace-heading">
                <div>
                  <div className="tt-eyebrow">FIND YOUR PEOPLE</div>
                  <h1>Communities</h1>
                  <p>Explore the communities across TrenchTalk.</p>
                </div>
              </div>

              <div className="tt-home-community-grid">
                {communities.map((community, index) => (
                  <button
                    className="tt-home-community-card"
                    key={community.name}
                    onClick={() => {
                      setActiveCommunity(index);
                      setActivePage("community");
                    }}
                  >
                    <span className="tt-home-community-icon" style={{ background: community.color }}>
                      {community.icon}
                    </span>
                    <strong>{community.name}</strong>
                    <small>{community.category} · {community.members} members</small>
                    <span className="tt-home-community-arrow">↗</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {activePage === "bookmarks" && (
            <>
              <div className="tt-workspace-heading">
                <div>
                  <div className="tt-eyebrow">YOUR LIBRARY</div>
                  <h1>Saved posts</h1>
                  <p>Posts you've bookmarked.</p>
                </div>
              </div>

              <section className="tt-post-list">
                {visiblePosts.length === 0 ? (
                  <div className="tt-empty-state">
                    <span>☆</span>
                    <h2>No saved posts yet.</h2>
                    <p>Bookmark posts to find them here later.</p>
                  </div>
                ) : (
                  visiblePosts.map((post) => (
                    <article className="tt-post" key={post.id}>
                      <Avatar letter={post.avatar} large />
                      <div className="tt-post-content">
                        <div className="tt-post-header">
                          <div className="tt-post-author">
                            <strong>{post.name}</strong>
                            <span>@{post.user}</span>
                            <i>·</i>
                            <span>{post.time}</span>
                          </div>
                        </div>
                        <p className="tt-post-text">{post.text}</p>
                        <div className="tt-post-actions">
                          <button onClick={() => toggleLike(post.id)}>♡ {post.likes}</button>
                          <button className="tt-bookmark saved" onClick={() => toggleBookmark(post.id)}>★</button>
                        </div>
                      </div>
                    </article>
                  ))
                )}
              </section>
            </>
          )}

          {activePage === "messages" && (
            <div className="tt-empty-state">
              <span>✉</span>
              <h2>Your conversations will appear here.</h2>
              <p>Direct messaging is coming in the next development stage.</p>
            </div>
          )}

          {activePage === "notifications" && (
            <div className="tt-empty-state">
              <span>♧</span>
              <h2>You're all caught up.</h2>
              <p>New activity and notifications will appear here.</p>
            </div>
          )}

          {activePage === "profile" && (
            <section className="tt-profile-card">
              <Avatar letter={username[0]?.toUpperCase()} large />
              <div>
                <h2>{username}</h2>
                <p>@{username}</p>
                <span>{user.email}</span>
              </div>
            </section>
          )}
        </main>

        {/* CONTEXTUAL RIGHT PANEL */}
        <aside className="tt-context-panel">
          {activePage === "community" ? (
            <>
              <div className="tt-context-heading">COMMUNITY DETAILS</div>
              <div className="tt-context-community">
                <div className="tt-context-community-icon">
                  {communities[activeCommunity].icon}
                </div>
                <h3>{communities[activeCommunity].name}</h3>
                <p>{communities[activeCommunity].category}</p>
                <strong>{communities[activeCommunity].members} members</strong>
              </div>
              <div className="tt-context-heading">CHANNEL INFORMATION</div>
              <p className="tt-context-copy">
                You're viewing #{activeChannel}. Join the conversation with your community.
              </p>
            </>
          ) : activePage === "home" ? (
            <>
              <div className="tt-context-heading">YOUR NETWORK</div>
              <div className="tt-context-stat">
                <strong>{communities.length}</strong>
                <span>Communities to explore</span>
              </div>
              <div className="tt-context-heading">QUICK LINKS</div>
              <button className="tt-context-link" onClick={() => navigate("feed")}>Open social feed ↗</button>
              <button className="tt-context-link" onClick={() => navigate("explore")}>Discover topics ↗</button>
              <button className="tt-context-link" onClick={() => navigate("communities")}>Find communities ↗</button>
            </>
          ) : activePage === "explore" ? (
            <>
              <div className="tt-context-heading">TRENDING NOW</div>
              {trends.map((trend) => (
                <button
                  className="tt-context-trend"
                  key={trend.tag}
                  onClick={() => setSearch(trend.tag.replace("#", ""))}
                >
                  <strong>{trend.tag}</strong>
                  <span>{trend.posts}</span>
                </button>
              ))}
              <div className="tt-context-heading">DISCOVER</div>
              <button className="tt-context-link" onClick={() => navigate("communities")}>Browse all communities ↗</button>
            </>
          ) : (
            <>
              <div className="tt-context-heading">TRENCHTALK</div>
              <div className="tt-context-brand">
                <img src="/logo2.png" alt="" />
                <strong>Community without limits.</strong>
                <span>Find your people. Join the conversation.</span>
              </div>
              <div className="tt-context-heading">YOUR ACCOUNT</div>
              <div className="tt-context-user">
                <Avatar letter={username[0]?.toUpperCase()} />
                <div>
                  <strong>{username}</strong>
                  <span>Online</span>
                </div>
              </div>
            </>
          )}
        </aside>
      </div>

      <style>{`
        .tt-redesign {
          --tt-bg: #e9eddf;
          --tt-side: #dfe6d5;
          --tt-panel: #f3f5eb;
          --tt-dark: #17291c;
          --tt-dark-soft: #243b29;
          --tt-accent: #d4fb0c;
          --tt-muted: #73816c;
          min-height: 100vh;
          background: var(--tt-bg);
          color: var(--tt-dark);
          font-family: "DM Sans", "Segoe UI", sans-serif;
        }

        .tt-redesign .tt-topbar {
          height: 76px;
          padding: 0 25px;
          display: grid;
          grid-template-columns: 245px minmax(220px, 1fr) 190px;
          gap: 24px;
          align-items: center;
          background: var(--tt-dark);
          border-bottom: 3px solid var(--tt-accent);
          position: sticky;
          top: 0;
          z-index: 20;
        }

        .tt-redesign .tt-brand {
          display: flex;
          align-items: center;
          gap: 10px;
          background: none;
          border: 0;
          color: white;
          cursor: pointer;
        }

        .tt-redesign .tt-brand img {
          width: 38px;
          height: 38px;
          object-fit: contain;
        }

        .tt-redesign .tt-brand > span {
          font-size: 20px;
          font-weight: 800;
          letter-spacing: -1px;
          color: white;
        }

        .tt-redesign .tt-brand > span > span {
          color: var(--tt-accent);
        }

        .tt-redesign .tt-search {
          max-width: 760px;
          width: 100%;
          margin: auto;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 0 15px;
          height: 43px;
          background: #263b2b;
          border: 1px solid #496047;
          color: var(--tt-accent);
        }

        .tt-redesign .tt-search input {
          flex: 1;
          min-width: 0;
          background: transparent;
          border: 0;
          outline: 0;
          color: white;
          font: inherit;
        }

        .tt-redesign .tt-search input::placeholder {
          color: #b0bba8;
        }

        .tt-redesign .tt-search kbd {
          color: var(--tt-accent);
          font-size: 10px;
          border: 1px solid #60734e;
          padding: 4px 7px;
        }

        .tt-redesign .tt-top-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 20px;
          position: relative;
        }

        .tt-redesign .tt-beta {
          color: #e5eadc;
          font-size: 11px;
          letter-spacing: 1px;
          font-weight: 800;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .tt-redesign .tt-beta span,
        .tt-redesign .tt-feed-status span {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--tt-accent);
          display: inline-block;
        }

        .tt-redesign .tt-top-avatar {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          background: var(--tt-accent);
          color: var(--tt-dark);
          border: 0;
          font-size: 16px;
          font-weight: 800;
          cursor: pointer;
        }

        .tt-redesign .tt-account-menu {
          position: absolute;
          top: 55px;
          right: 0;
          z-index: 30;
          width: 190px;
          padding: 13px;
          background: var(--tt-panel);
          border: 1px solid #c8d2bd;
          box-shadow: 0 12px 30px #17291c20;
          display: grid;
          gap: 9px;
        }

        .tt-redesign .tt-account-menu button {
          border: 0;
          background: #e4eadb;
          padding: 9px;
          text-align: left;
          cursor: pointer;
          color: var(--tt-dark);
        }

        .tt-workspace {
          min-height: calc(100vh - 76px);
          display: grid;
          grid-template-columns: 76px 245px minmax(360px, 1fr) 265px;
          align-items: stretch;
        }

        .tt-server-rail {
          background: var(--tt-dark);
          padding: 17px 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          min-height: calc(100vh - 76px);
          position: sticky;
          top: 76px;
          height: calc(100vh - 76px);
          overflow-y: auto;
        }

        .tt-server-rail button {
          width: 47px;
          height: 47px;
          border: 0;
          border-radius: 16px;
          display: grid;
          place-items: center;
          cursor: pointer;
          font-size: 20px;
          font-weight: 800;
          transition: border-radius .18s, transform .18s;
        }

        .tt-server-rail button:hover,
        .tt-server-rail button.active {
          border-radius: 12px;
          transform: translateY(-1px);
        }

        .tt-server-home {
          background: #263c2b;
          border: 1px solid #557044 !important;
        }

        .tt-server-home img {
          width: 31px;
          height: 31px;
          object-fit: contain;
        }

        .tt-rail-divider {
          width: 31px;
          height: 2px;
          background: #496047;
          margin: 2px 0;
        }

        .tt-server-icon {
          background: var(--community-color, #304b32);
          color: var(--tt-accent);
          border-left: 3px solid transparent !important;
        }

        .tt-server-icon.active {
          border-left-color: var(--tt-accent) !important;
        }

        .tt-server-add,
        .tt-server-discover {
          background: #263c2b;
          color: var(--tt-accent);
          border: 1px solid #496047 !important;
        }

        .tt-channel-sidebar {
          background: var(--tt-side);
          border-right: 1px solid #cbd4c1;
          padding: 22px 15px 90px;
          position: sticky;
          top: 76px;
          height: calc(100vh - 76px);
          overflow-y: auto;
        }

        .tt-channel-brand {
          padding: 0 8px 23px;
          margin-bottom: 22px;
          border-bottom: 1px solid #c5cfba;
        }

        .tt-channel-brand-name {
          font-size: 21px;
          font-weight: 850;
          letter-spacing: -1px;
          color: var(--tt-dark);
        }

        .tt-channel-brand-name span {
          color: #71952b;
        }

        .tt-channel-brand-subtitle {
          margin-top: 5px;
          font-size: 9px;
          letter-spacing: 1.5px;
          font-weight: 800;
          color: #819076;
        }

        .tt-redesign .tt-sidebar-label {
          padding: 0 10px;
          margin: 18px 0 9px;
          font-size: 9px;
          letter-spacing: 1.7px;
          font-weight: 850;
          color: #78876e;
        }

        .tt-redesign .tt-navigation {
          display: grid;
          gap: 4px;
        }

        .tt-redesign .tt-nav-item {
          height: 42px;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 0 11px;
          border: 0;
          background: transparent;
          color: #53644e;
          text-align: left;
          font: inherit;
          font-size: 12px;
          font-weight: 650;
          cursor: pointer;
          transition: background .18s, color .18s;
        }

        .tt-redesign .tt-nav-item:hover {
          background: #d2ddc6;
          color: var(--tt-dark);
        }

        .tt-redesign .tt-nav-item.active {
          background: var(--tt-dark);
          color: var(--tt-accent);
          box-shadow: 4px 4px 0 #c4df91;
        }

        .tt-redesign .tt-nav-icon {
          width: 19px;
          text-align: center;
          font-size: 18px;
        }

        .tt-redesign .tt-nav-count {
          margin-left: auto;
          color: #6b8c32;
          font-size: 10px;
        }

        .tt-redesign .tt-sidebar-divider {
          height: 1px;
          background: #c5cfba;
          margin: 20px 4px;
        }

        .tt-redesign .tt-sidebar-communities {
          display: grid;
          gap: 4px;
        }

        .tt-redesign .tt-community-shortcut {
          min-width: 0;
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 8px 7px;
          border: 0;
          background: transparent;
          text-align: left;
          color: #344b36;
          font: inherit;
          font-size: 11px;
          cursor: pointer;
        }

        .tt-redesign .tt-community-shortcut:hover {
          background: #d2ddc6;
        }

        .tt-redesign .tt-community-icon {
          width: 29px;
          height: 29px;
          flex-shrink: 0;
          display: grid;
          place-items: center;
          background: var(--tt-dark);
          color: var(--tt-accent);
          font-weight: 800;
        }

        .tt-redesign .tt-create-community {
          width: 100%;
          margin-top: 14px;
          padding: 10px;
          background: transparent;
          border: 1px dashed #a9b89e;
          color: #52674a;
          text-align: left;
          font: inherit;
          font-size: 11px;
          cursor: pointer;
        }

        .tt-redesign .tt-create-community:hover {
          background: #d2ddc6;
        }

        .tt-redesign .tt-sidebar-account {
          position: fixed;
          bottom: 0;
          left: 76px;
          width: 245px;
          min-height: 67px;
          padding: 10px 13px;
          background: #d4ddc9;
          border-top: 1px solid #bdcbb5;
          display: flex;
          align-items: center;
          gap: 9px;
          z-index: 5;
        }

        .tt-redesign .tt-avatar {
          width: 34px;
          height: 34px;
          flex-shrink: 0;
          display: grid;
          place-items: center;
          background: var(--tt-dark);
          color: var(--tt-accent);
          font-weight: 800;
          font-size: 13px;
        }

        .tt-redesign .tt-avatar-large {
          width: 46px;
          height: 46px;
          font-size: 17px;
        }

        .tt-redesign .tt-account-info {
          min-width: 0;
          display: grid;
          gap: 3px;
          font-size: 11px;
        }

        .tt-redesign .tt-account-info strong {
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .tt-redesign .tt-account-info span {
          color: #75846e;
          font-size: 10px;
        }

        .tt-redesign .tt-account-dots {
          margin-left: auto;
          border: 0;
          background: transparent;
          font-size: 19px;
          cursor: pointer;
        }

        .tt-redesign .tt-community-sidebar-heading {
          display: flex;
          justify-content: space-between;
          padding: 9px 10px;
          font-size: 12px;
          font-weight: 800;
          color: var(--tt-dark);
        }

        .tt-redesign .tt-channel-list {
          display: grid;
          gap: 3px;
        }

        .tt-redesign .tt-channel-item {
          border: 0;
          background: transparent;
          color: #66745f;
          text-align: left;
          padding: 9px 11px;
          font: inherit;
          font-size: 12px;
          cursor: pointer;
        }

        .tt-redesign .tt-channel-item span {
          margin-right: 9px;
          font-size: 15px;
        }

        .tt-redesign .tt-channel-item:hover,
        .tt-redesign .tt-channel-item.active {
          background: #d0dbc5;
          color: var(--tt-dark);
        }

        .tt-main-feed {
          min-width: 0;
          max-width: none !important;
          padding: 35px clamp(22px, 3vw, 48px) 70px;
          background:
            radial-gradient(ellipse at 48% 0%, rgba(255,255,255,.32), transparent 50%),
            var(--tt-bg);
        }

        .tt-workspace-heading {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 20px;
          padding-bottom: 25px;
          margin-bottom: 25px;
          border-bottom: 1px solid #cbd4c1;
        }

        .tt-redesign .tt-eyebrow {
          margin-bottom: 9px;
          font-size: 9px;
          letter-spacing: 2px;
          font-weight: 850;
          color: #81906f;
        }

        .tt-workspace-heading h1 {
          margin: 0;
          font-size: clamp(27px, 3vw, 39px);
          line-height: 1.1;
          letter-spacing: -1.8px;
          color: var(--tt-dark);
        }

        .tt-workspace-heading p {
          margin: 9px 0 0;
          color: #77836f;
          font-size: 12px;
        }

        .tt-redesign .tt-feed-status {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 13px;
          border: 1px solid #c6d4b5;
          color: #698b32;
          font-size: 9px;
          letter-spacing: 1px;
          font-weight: 850;
          white-space: nowrap;
        }

        .tt-home-welcome {
          min-height: 215px;
          padding: 32px;
          margin-bottom: 32px;
          position: relative;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background:
            radial-gradient(circle at 85% 50%, rgba(212,251,12,.12), transparent 35%),
            var(--tt-dark);
          color: #f0f3e8;
          box-shadow: 0 12px 28px rgba(23,41,28,.12);
        }

        .tt-home-welcome .tt-eyebrow {
          color: var(--tt-accent);
        }

        .tt-home-welcome h2 {
          margin: 0;
          font-size: clamp(25px, 3vw, 35px);
          line-height: 1.1;
          letter-spacing: -1.5px;
        }

        .tt-home-welcome p {
          max-width: 440px;
          color: #b5c3ae;
          font-size: 12px;
          line-height: 1.7;
        }

        .tt-home-welcome button {
          padding: 12px 15px;
          background: var(--tt-accent);
          border: 0;
          color: var(--tt-dark);
          font-size: 10px;
          font-weight: 850;
          cursor: pointer;
        }

        .tt-home-mark {
          position: absolute;
          right: 35px;
          top: 50%;
          transform: translateY(-50%);
          font-size: 170px;
          font-weight: 900;
          line-height: 1;
          color: rgba(212,251,12,.08);
          pointer-events: none;
        }

        .tt-home-section-heading {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 15px;
          margin: 25px 0 15px;
        }

        .tt-home-section-heading h2 {
          margin: 0;
          font-size: 17px;
          letter-spacing: -.5px;
        }

        .tt-home-section-heading span {
          display: block;
          margin-top: 5px;
          font-size: 11px;
          color: #829078;
        }

        .tt-home-section-heading > button {
          border: 0;
          background: transparent;
          color: #66872c;
          font-size: 10px;
          font-weight: 850;
          cursor: pointer;
        }

        .tt-home-community-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 13px;
          margin-bottom: 30px;
        }

        .tt-home-community-card {
          position: relative;
          min-width: 0;
          min-height: 135px;
          padding: 17px;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 8px;
          background: var(--tt-panel);
          border: 1px solid #d1d9c8;
          text-align: left;
          color: var(--tt-dark);
          cursor: pointer;
          transition: transform .18s, box-shadow .18s;
        }

        .tt-home-community-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 9px 18px #17291c14;
        }

        .tt-home-community-icon {
          width: 34px;
          height: 34px;
          display: grid;
          place-items: center;
          color: var(--tt-accent);
          font-weight: 850;
        }

        .tt-home-community-card strong {
          font-size: 12px;
        }

        .tt-home-community-card small {
          color: #84917b;
          font-size: 10px;
        }

        .tt-home-community-arrow {
          position: absolute;
          top: 17px;
          right: 16px;
          color: #72932f;
        }

        .tt-redesign .tt-post-list {
          display: grid;
          gap: 13px;
        }

        .tt-redesign .tt-post {
          display: flex;
          gap: 14px;
          padding: 20px;
          background: var(--tt-panel);
          border: 1px solid #d0d8c7;
          box-shadow: 0 4px 12px rgba(23,41,28,.035);
        }

        .tt-redesign .tt-post-content {
          flex: 1;
          min-width: 0;
        }

        .tt-redesign .tt-post-header {
          display: flex;
          justify-content: space-between;
          gap: 10px;
        }

        .tt-redesign .tt-post-author {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 7px;
          font-size: 11px;
        }

        .tt-redesign .tt-post-author > span {
          color: #84917b;
        }

        .tt-redesign .tt-post-author i {
          color: #a2ad98;
          font-style: normal;
        }

        .tt-redesign .tt-verified {
          width: 15px;
          height: 15px;
          display: inline-grid;
          place-items: center;
          border-radius: 50%;
          background: #779c35;
          color: white;
          font-size: 10px;
        }

        .tt-redesign .tt-post-community {
          display: inline-block;
          margin: 10px 0 5px;
          padding: 5px 8px;
          background: #e4edcf;
          color: #718d39;
          font-size: 9px;
          font-weight: 850;
          letter-spacing: .8px;
        }

        .tt-redesign .tt-post-text {
          color: #364737;
          font-size: 13px;
          line-height: 1.7;
        }

        .tt-redesign .tt-post-actions {
          display: flex;
          align-items: center;
          gap: 22px;
          margin-top: 15px;
        }

        .tt-redesign .tt-post-actions button {
          border: 0;
          background: transparent;
          color: #7b8973;
          font: inherit;
          font-size: 11px;
          cursor: pointer;
        }

        .tt-redesign .tt-post-actions button:hover,
        .tt-redesign .tt-post-actions button.liked,
        .tt-redesign .tt-post-actions button.saved {
          color: #6b902b;
        }

        .tt-redesign .tt-post-more {
          border: 0;
          background: transparent;
          color: #7b8973;
          font-size: 18px;
          cursor: pointer;
        }

        .tt-redesign .tt-feed-tabs {
          display: flex;
          gap: 25px;
          margin: -5px 0 20px;
          border-bottom: 1px solid #cbd4c1;
        }

        .tt-redesign .tt-feed-tabs button {
          padding: 12px 5px;
          border: 0;
          border-bottom: 3px solid transparent;
          background: transparent;
          color: #71806a;
          font: inherit;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }

        .tt-redesign .tt-feed-tabs button.selected {
          border-bottom-color: var(--tt-dark);
          color: var(--tt-dark);
        }

        .tt-redesign .tt-composer {
          padding: 20px;
          margin-bottom: 18px;
          background: var(--tt-dark);
          color: #edf2e6;
          box-shadow: 0 8px 18px rgba(23,41,28,.12);
        }

        .tt-redesign .tt-composer-top {
          display: flex;
          gap: 13px;
        }

        .tt-redesign .tt-composer textarea {
          flex: 1;
          min-height: 75px;
          resize: vertical;
          background: transparent;
          border: 0;
          outline: 0;
          color: white;
          font: inherit;
          font-size: 13px;
        }

        .tt-redesign .tt-composer textarea::placeholder {
          color: #aab7a3;
        }

        .tt-redesign .tt-composer-bottom {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-top: 13px;
          margin-top: 12px;
          border-top: 1px solid #344b37;
          color: #aab7a3;
          font-size: 10px;
        }

        .tt-redesign .tt-composer-bottom button {
          padding: 11px 15px;
          background: var(--tt-accent);
          border: 0;
          color: var(--tt-dark);
          font-weight: 850;
          font-size: 10px;
          cursor: pointer;
        }

        .tt-redesign .tt-composer-bottom button:disabled {
          opacity: .45;
          cursor: not-allowed;
        }

        .tt-context-panel {
          padding: 28px 17px;
          background: #e1e8d8;
          border-left: 1px solid #cbd4c1;
          min-width: 0;
        }

        .tt-context-heading {
          padding-bottom: 12px;
          margin: 0 0 13px;
          border-bottom: 1px solid #c5d0ba;
          color: #718064;
          font-size: 9px;
          letter-spacing: 1.5px;
          font-weight: 850;
        }

        .tt-context-stat {
          display: grid;
          gap: 5px;
          padding: 18px 13px;
          margin-bottom: 25px;
          background: var(--tt-panel);
          border: 1px solid #d0d9c5;
        }

        .tt-context-stat strong {
          font-size: 28px;
          color: var(--tt-dark);
        }

        .tt-context-stat span,
        .tt-context-copy {
          color: #7b8973;
          font-size: 11px;
          line-height: 1.6;
        }

        .tt-context-link {
          width: 100%;
          display: block;
          padding: 11px 5px;
          border: 0;
          border-bottom: 1px solid #ccd5c2;
          background: transparent;
          color: #42573e;
          text-align: left;
          font: inherit;
          font-size: 11px;
          cursor: pointer;
        }

        .tt-context-link:hover {
          color: #6d912d;
        }

        .tt-context-trend {
          width: 100%;
          padding: 12px 5px;
          display: grid;
          gap: 5px;
          border: 0;
          border-bottom: 1px solid #cbd4c1;
          background: transparent;
          text-align: left;
          cursor: pointer;
        }

        .tt-context-trend strong {
          color: #263d29;
          font-size: 12px;
        }

        .tt-context-trend span {
          color: #89947f;
          font-size: 10px;
        }

        .tt-context-community {
          padding: 17px 10px;
          margin-bottom: 25px;
          background: var(--tt-panel);
          text-align: center;
        }

        .tt-context-community-icon {
          width: 52px;
          height: 52px;
          display: grid;
          place-items: center;
          margin: 0 auto 12px;
          background: var(--tt-dark);
          color: var(--tt-accent);
          font-size: 22px;
          font-weight: 800;
        }

        .tt-context-community h3 {
          margin: 0;
          font-size: 13px;
        }

        .tt-context-community p,
        .tt-context-community strong {
          display: block;
          margin-top: 7px;
          color: #829078;
          font-size: 10px;
        }

        .tt-context-brand {
          display: grid;
          justify-items: start;
          gap: 10px;
          padding: 13px;
          margin-bottom: 25px;
          background: var(--tt-panel);
        }

        .tt-context-brand img {
          width: 38px;
          height: 38px;
          object-fit: contain;
        }

        .tt-context-brand strong {
          font-size: 12px;
        }

        .tt-context-brand span {
          color: #819078;
          font-size: 10px;
          line-height: 1.5;
        }

        .tt-context-user {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 11px;
        }

        .tt-context-user div:last-child {
          display: grid;
          gap: 4px;
        }

        .tt-context-user span {
          color: #819078;
          font-size: 10px;
        }

        .tt-redesign .tt-empty-state,
        .tt-redesign .tt-community-placeholder {
          padding: 55px 20px;
          background: var(--tt-panel);
          border: 1px solid #d0d8c7;
          text-align: center;
        }

        .tt-redesign .tt-empty-state > span {
          font-size: 34px;
          color: #779b39;
        }

        .tt-redesign .tt-empty-state h2,
        .tt-redesign .tt-community-placeholder h2 {
          font-size: 18px;
        }

        .tt-redesign .tt-empty-state p,
        .tt-redesign .tt-community-placeholder p,
        .tt-redesign .tt-community-placeholder > span {
          color: #829078;
          font-size: 12px;
          line-height: 1.6;
        }

        .tt-community-placeholder-icon {
          width: 65px;
          height: 65px;
          display: grid;
          place-items: center;
          margin: 0 auto 17px;
          background: var(--tt-dark);
          color: var(--tt-accent);
          font-size: 25px;
          font-weight: 850;
        }

        .tt-explore-section {
          margin-bottom: 30px;
        }

        .tt-explore-trends {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .tt-explore-trends button {
          display: grid;
          grid-template-columns: 30px 1fr auto;
          align-items: center;
          gap: 8px;
          padding: 17px;
          background: var(--tt-panel);
          border: 1px solid #d0d8c7;
          text-align: left;
          cursor: pointer;
        }

        .tt-explore-trends button > span {
          color: #849275;
          font-size: 11px;
        }

        .tt-explore-trends button strong {
          color: var(--tt-dark);
          font-size: 13px;
        }

        .tt-explore-trends button small {
          grid-column: 2;
          color: #849275;
          font-size: 10px;
        }

        .tt-explore-trends button b {
          grid-column: 3;
          grid-row: 1 / span 2;
          color: #72952f;
        }

        .tt-redesign .tt-profile-card {
          display: flex;
          align-items: center;
          gap: 20px;
          padding: 25px;
          background: var(--tt-panel);
          border: 1px solid #d0d8c7;
        }

        .tt-redesign .tt-profile-card h2 {
          margin: 0;
        }

        .tt-redesign .tt-profile-card p,
        .tt-redesign .tt-profile-card span {
          color: #829078;
          font-size: 12px;
        }

        @media (max-width: 1250px) {
          .tt-workspace {
            grid-template-columns: 68px 220px minmax(300px, 1fr);
          }

          .tt-context-panel {
            display: none;
          }

          .tt-redesign .tt-sidebar-account {
            left: 68px;
            width: 220px;
          }
        }

        @media (max-width: 850px) {
          .tt-redesign .tt-topbar {
            grid-template-columns: auto minmax(100px, 1fr) auto;
            gap: 12px;
            padding: 0 13px;
          }

          .tt-redesign .tt-brand > span {
            display: none;
          }

          .tt-workspace {
            grid-template-columns: 62px minmax(0, 1fr);
          }

          .tt-channel-sidebar {
            display: none;
          }

          .tt-server-rail {
            grid-column: 1;
          }

          .tt-main-feed {
            grid-column: 2;
            padding: 25px 18px 60px;
          }

          .tt-redesign .tt-sidebar-account {
            display: none;
          }

          .tt-home-community-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 560px) {
          .tt-redesign .tt-topbar {
            height: 65px;
            grid-template-columns: 38px minmax(0, 1fr) 40px;
          }

          .tt-redesign .tt-brand img {
            width: 34px;
            height: 34px;
          }

          .tt-redesign .tt-search {
            height: 38px;
            padding: 0 9px;
          }

          .tt-redesign .tt-search kbd,
          .tt-redesign .tt-beta {
            display: none;
          }

          .tt-redesign .tt-top-avatar {
            width: 36px;
            height: 36px;
          }

          .tt-workspace {
            min-height: calc(100vh - 65px);
            grid-template-columns: 54px minmax(0, 1fr);
          }

          .tt-server-rail {
            top: 65px;
            height: calc(100vh - 65px);
            min-height: calc(100vh - 65px);
          }

          .tt-server-rail button {
            width: 39px;
            height: 39px;
          }

          .tt-main-feed {
            padding: 23px 12px 50px;
          }

          .tt-workspace-heading {
            align-items: flex-start;
            flex-direction: column;
          }

          .tt-home-welcome {
            padding: 22px;
            min-height: 190px;
          }

          .tt-home-mark {
            right: 12px;
            font-size: 120px;
          }

          .tt-home-community-grid,
          .tt-explore-trends {
            grid-template-columns: 1fr;
          }

          .tt-redesign .tt-post {
            padding: 13px;
            gap: 9px;
          }

          .tt-redesign .tt-avatar-large {
            width: 36px;
            height: 36px;
          }

          .tt-redesign .tt-post-actions {
            gap: 13px;
          }
        }
      `}</style>
    </div>
  );
}

export default App;