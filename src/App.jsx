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
    setMenuOpen(false);
  }

  function openComposer() {
    setActivePage("home");

    setTimeout(() => {
      document.querySelector(".tt-composer textarea")?.focus();
    }, 50);
  }

  function createPost(event) {
    event.preventDefault();

    const text = postText.trim();

    if (!text || posting) return;

    setPosting(true);

    // Posts are not connected to a backend yet.
    // This prevents displaying fake or temporary feed content.

    setPostText("");
    setPosting(false);

    alert("Posting will be available once the post database is connected.");
  }

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

  const pageTitle = {
    home: "Your feed",
    explore: "Explore",
    communities: "Communities",
    messages: "Messages",
    notifications: "Notifications",
    bookmarks: "Saved posts",
    profile: "Your profile",
  }[activePage] || "Your feed";

  return (
    <div className="tt-dashboard">

      {/* LEFT SIDEBAR */}

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

        {/* POST BUTTON */}

        <button
          className="tt-compose-sidebar"
          onClick={openComposer}
        >
          <span>＋</span>
          <span>Post</span>
        </button>

        {/* PROFILE AT BOTTOM OF SIDEBAR */}

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

      {/* MAIN CONTENT */}

      <main className="tt-main-feed">

        {/* MOBILE HEADER */}

        <header className="tt-mobile-header">
          <img src="/logo2.png" alt="" />

          <strong>
            TRENCH<span>TALK</span>
          </strong>
        </header>

        {/* PAGE HEADING */}

        <div className="tt-feed-heading">
          <div>
            <div className="tt-eyebrow">YOUR COMMUNITY</div>

            <h1>{pageTitle}</h1>

            <p>
              {activePage === "home"
                ? "See what's happening across TrenchTalk."
                : "Discover what's happening in the community."}
            </p>
          </div>
        </div>

        {/* HOME */}

        {activePage === "home" && (
          <>
            <div className="tt-feed-tabs">
              <button className="selected">For you</button>

              <button>
                Following
              </button>
            </div>

            {/* POST COMPOSER */}

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

            {/* EMPTY FEED */}

            <section className="tt-empty-feed">

              <div className="tt-empty-icon">
                ◈
              </div>

              <h2>Nothing to see here yet.</h2>

              <p>
                Your feed is looking a little quiet.
                Check back later when your community starts posting.
              </p>

            </section>
          </>
        )}

        {/* EXPLORE */}

        {activePage === "explore" && (
          <section className="tt-page-content">

            <label className="tt-explore-search">
              <span>⌕</span>

              <input
                type="search"
                placeholder="Search TrenchTalk..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>

            <div className="tt-empty-feed">
              <div className="tt-empty-icon">⌕</div>
              <h2>Nothing to see here yet.</h2>
              <p>Explore content will appear here.</p>
            </div>

          </section>
        )}

        {/* COMMUNITIES */}

        {activePage === "communities" && (
          <section className="tt-empty-feed">
            <div className="tt-empty-icon">◈</div>
            <h2>No communities yet.</h2>
            <p>Communities will appear here once they are available.</p>
          </section>
        )}

        {/* MESSAGES */}

        {activePage === "messages" && (
          <section className="tt-empty-feed">
            <div className="tt-empty-icon">✉</div>
            <h2>No messages yet.</h2>
            <p>Your conversations will appear here.</p>
          </section>
        )}

        {/* NOTIFICATIONS */}

        {activePage === "notifications" && (
          <section className="tt-empty-feed">
            <div className="tt-empty-icon">♧</div>
            <h2>You're all caught up.</h2>
            <p>New notifications will appear here.</p>
          </section>
        )}

        {/* SAVED POSTS */}

        {activePage === "bookmarks" && (
          <section className="tt-empty-feed">
            <div className="tt-empty-icon">☆</div>
            <h2>No saved posts yet.</h2>
            <p>Posts you save will appear here.</p>
          </section>
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

      </main>
    </div>
  );
}

export default App;