import { useState } from "react";
export default function ProfilePage({ user, profile, onNavigate, onLogout }) {
  const [activeTab, setActiveTab] = useState("Posts");

  const username =
    profile?.username ||
    user?.displayName ||
    user?.email?.split("@")[0] ||
    "member";
  const displayName = profile?.displayName || username;

  // Counts are read from the profile document when available.
  // The current app does not yet load a posts/followers/communities collection.
  const stats = [
    { label: "Following", value: profile?.followingCount ?? 0 },
    { label: "Posts", value: profile?.postsCount ?? 0 },
    { label: "Followers", value: profile?.followersCount ?? 0 },
  ];

  return (
    <div className="ttpe-layout">
      <aside className="ttpe-sidebar">
        <div className="ttpe-sidebar-heading">USER SETTINGS</div>
        <button type="button" className="ttpe-nav-item active" onClick={() => onNavigate("profile")}>
          <span className="ttpe-nav-icon">◉</span>
          My Profile
        </button>
        <button type="button" className="ttpe-nav-item" onClick={() => onNavigate("profile-customisation")}>
          <span className="ttpe-nav-icon">✳</span>
          Profile Customisation
        </button>
        <div className="ttpe-sidebar-divider" />
        <div className="ttpe-sidebar-account">
          <div className="ttpe-sidebar-avatar">
            {profile?.avatarUrl ? <img src={profile.avatarUrl} alt="" /> : (displayName?.[0]?.toUpperCase() || "T")}
          </div>
          <div className="ttpe-sidebar-account-info">
            <strong>{displayName}</strong>
            <span>@{username}</span>
          </div>
        </div>
        <div className="ttpe-sidebar-actions">
          <button
            type="button"
            className="ttpe-add-account"
            onClick={() => window.dispatchEvent(new Event("tt-open-add-account"))}
          >
            <span aria-hidden="true">+</span><span className="ttpe-add-account-label">Add another account</span>
          </button>
          <button type="button" className="ttpe-logout-button" onClick={onLogout}>
            Log out
          </button>
        </div>
      </aside>
      <main className="ttpe-main">
        <section className="tt-profile-page">
      <div className="tt-profile-page-heading">
        <div>
          <span className="tt-eyebrow">YOUR ACCOUNT</span>
          <h1>My Profile</h1>
          <p>Your activity and identity across TrenchTalk.</p>
        </div>
      </div>

      <div className="tt-public-profile-card">
        <div
          className="tt-public-profile-banner"
          style={{
            backgroundColor: profile?.accentColor || "#b9d85a",
            backgroundImage: profile?.bannerUrl ? `url(${profile.bannerUrl})` : "none",
          }}
        />
        <div className="tt-public-profile-content">
          <div className="tt-public-profile-avatar">
            {profile?.avatarUrl ? (
              <img src={profile.avatarUrl} alt={`${displayName}'s profile`} />
            ) : (
              <span>{displayName?.[0]?.toUpperCase() || "T"}</span>
            )}
          </div>
          <div className="tt-public-profile-identity">
            <div>
              <h2>{displayName}</h2>
              <span>@{username}</span>
            </div>
            <p>{profile?.bio || "No bio added yet."}</p>
          </div>
          <div className="tt-profile-stats">
            {stats.map((stat) => (
              <div className="tt-profile-stat" key={stat.label}>
                <strong>{stat.value}</strong>
                <span>{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="tt-public-profile-tabs" role="tablist" aria-label="Profile content">
        {["Posts", "Reposts", "Communities"].map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            className={activeTab === tab ? "selected" : ""}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="tt-profile-empty">
        <span>{activeTab === "Communities" ? "◈" : "▤"}</span>
        <h2>No {activeTab.toLowerCase()} yet</h2>
        <p>{activeTab === "Communities" ? "Communities this member joins will appear here." : "When you share something on TrenchTalk, it will appear here."}</p>
        <button onClick={() => onNavigate("feed")}>Explore the feed</button>
      </div>
        </section>
      </main>
    </div>
  );
}
