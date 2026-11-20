import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import Login from "./pages/login.jsx";
import "./App.css";

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

function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [activePage, setActivePage] = useState("home");
  const [postText, setPostText] = useState("");
  const [search, setSearch] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

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

    // Posts will be connected to Firestore in the next stage.
    console.log("Post ready for submission:", postText.trim());

    setPostText("");
    alert("Post publishing will be available when the feed database is connected.");
  }

  if (authLoading) {
    return (
      <div className="tt-loading">
        <img src="/logo2.png" alt="TrenchTalk" />
        <span>LOADING TRENCHTALK</span>
      </div>
    );
  }

  if (!user) return <Login />;

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

        {/* PROFILE AT TOP */}

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

        {/* BRAND */}

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

        {/* NAVIGATION */}

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

        {/* POST ACTION */}

        <button
          className="tt-post-button"
          onClick={openPost}
        >
          <span>＋</span>
          Create a post
        </button>

        {/* SIDEBAR FOOTER */}

        <div className="tt-sidebar-footer">
          <span className="tt-footer-dot" />
          <span>Community without limits.</span>
        </div>

      </aside>

      {/* MAIN CONTENT */}

      <main className="tt-main">

        {/* TOP BAR */}

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

        {/* PAGE CONTENT */}

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

                  <span className="tt-card-label">
                    YOUR COMMUNITY
                  </span>

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

                  <span className="tt-card-label">
                    DISCOVER
                  </span>

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

                  <span className="tt-card-label">
                    FIND YOUR PEOPLE
                  </span>

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

              <div className="tt-empty-feed">
                <div className="tt-empty-symbol">◈</div>

                <h2>Nothing to see here yet.</h2>

                <p>
                  This is where posts from your community will appear.
                  Check back later.
                </p>
              </div>

            </section>
          )}

          {/* EXPLORE */}

          {activePage === "explore" && (
            <section className="tt-standard-page">

              <div className="tt-page-heading">
                <div>
                  <span className="tt-eyebrow">DISCOVER SOMETHING NEW</span>
                  <h1>Explore</h1>
                  <p>Find conversations and communities.</p>
                </div>
              </div>

              <label className="tt-search">
                <span>⌕</span>

                <input
                  type="search"
                  placeholder="Search TrenchTalk..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>

              <div className="tt-empty-feed">
                <div className="tt-empty-symbol">⌕</div>
                <h2>Nothing to see here yet.</h2>
                <p>Discoverable content will appear here.</p>
              </div>

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

              <div className="tt-empty-feed">
                <div className="tt-empty-symbol">◈</div>
                <h2>No communities yet.</h2>
                <p>Your communities will appear here.</p>
              </div>
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

              <div className="tt-empty-feed">
                <div className="tt-empty-symbol">✉</div>
                <h2>No messages yet.</h2>
                <p>Your conversations will appear here.</p>
              </div>
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

              <div className="tt-empty-feed">
                <div className="tt-empty-symbol">♧</div>
                <h2>You're all caught up.</h2>
                <p>New notifications will appear here.</p>
              </div>
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

              <div className="tt-empty-feed">
                <div className="tt-empty-symbol">☆</div>
                <h2>No saved posts yet.</h2>
                <p>Posts you save will appear here.</p>
              </div>
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