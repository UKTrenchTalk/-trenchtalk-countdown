import { useState } from "react";

export default function ProfilePage({
  user, profile, onNavigate, onLogout, viewOnly = false,
  savedAccounts = [], onAddAccount, onSelectAccount, onRemoveAccount
}) {
  const [activeTab, setActiveTab] = useState("Posts");
  const username = profile?.username || user?.displayName || user?.email?.split("@")[0] || "member";
  const displayName = profile?.displayName || username;
  const accent = profile?.accentColor || "#b9d85a";
  const stats = [
    { label: "Following", value: profile?.followingCount ?? 0 },
    { label: "Posts", value: profile?.postsCount ?? 0 },
    { label: "Followers", value: profile?.followersCount ?? 0 }
  ];
  const customStyle = {
    "--profile-accent": accent,
    "--profile-card": profile?.cardColor || "#e4eadc",
    "--profile-border": profile?.borderColor || "#bac8ae",
    "--profile-name": profile?.nameColor || "#263827",
    "--profile-avatar-border": profile?.avatarBorderColor || "#e4eadc"
  };
  const links = [["Website", profile?.website], ["X", profile?.twitter], ["Telegram", profile?.telegram]].filter(([, url]) => url);

  return (
    <div className="ttpe-layout">
      {!viewOnly && (
        <aside className="ttpe-sidebar">
          <div className="ttpe-sidebar-heading">USER SETTINGS</div>
          <button type="button" className="ttpe-nav-item active" onClick={() => onNavigate("profile")}><span className="ttpe-nav-icon">◉</span>My Profile</button>
          <button type="button" className="ttpe-nav-item" onClick={() => onNavigate("profile-customisation")}><span className="ttpe-nav-icon">✳</span>Profile Customisation</button>
          <div className="ttpe-sidebar-divider" />
          <div className="ttpe-sidebar-account">
            <div className="ttpe-sidebar-avatar">{profile?.avatarUrl ? <img src={profile.avatarUrl} alt="" /> : displayName[0]?.toUpperCase()}</div>
            <div className="ttpe-sidebar-account-info"><strong>{displayName}</strong><span>@{username}</span></div>
          </div>
          <div className="ttpe-sidebar-actions">
            <button type="button" className="ttpe-add-account" onClick={onAddAccount}><span>+</span><span className="ttpe-add-account-label">Add another account</span></button>
            <button type="button" className="ttpe-logout-button" onClick={onLogout}>Log out</button>
          </div>
          <div className="ttpe-saved-accounts">
            <div className="ttpe-sidebar-heading">SAVED ACCOUNTS</div>
            {savedAccounts.map(item => (
              <div className="ttpe-saved-account-row" key={item.uid}>
                <button type="button" className="ttpe-saved-account-select" onClick={() => onSelectAccount?.(item)}>
                  <span className="ttpe-sidebar-avatar">{(item.displayName || item.email || "?")[0].toUpperCase()}</span>
                  <span><strong>{item.displayName || item.email}</strong><small>{item.email}</small></span>
                </button>
                {item.uid !== user?.uid && <button type="button" className="ttpe-saved-account-remove" title="Remove account" aria-label={`Remove ${item.email}`} onClick={() => onRemoveAccount?.(item.uid)}>×</button>}
              </div>
            ))}
          </div>
        </aside>
      )}
      <main className="ttpe-main">
        <section className="tt-profile-page">
          <div className="tt-profile-page-heading">
            <div><span className="tt-eyebrow">{viewOnly ? "TRENCHTALK MEMBER" : "YOUR ACCOUNT"}</span><h1>{viewOnly ? displayName : "My Profile"}</h1><p>{viewOnly ? `@${username}` : "Your activity and identity across TrenchTalk."}</p></div>
            {!viewOnly && <button type="button" className="ttpe-save-button" onClick={() => onNavigate("profile-customisation")}>Edit profile</button>}
          </div>
          <div className={`tt-public-profile-card theme-${profile?.profileTheme || "minimal"} layout-${profile?.profileLayout || "standard"} decoration-${profile?.decoration || "none"}`} style={customStyle}>
            <div className="tt-public-profile-banner" style={{ backgroundColor: accent, backgroundImage: profile?.bannerUrl ? `url(${profile.bannerUrl})` : "none", backgroundPosition: profile?.bannerPosition || "center", height: `clamp(100px, ${profile?.bannerHeight || 220}px, 360px)` }} />
            <div className="tt-public-profile-content">
              <div className={`tt-public-profile-avatar shape-${profile?.avatarShape || "circle"} avatar-${profile?.avatarSize || "large"}`}>{profile?.avatarUrl ? <img src={profile.avatarUrl} alt={`${displayName}'s profile`} /> : <span>{displayName[0]?.toUpperCase() || "T"}</span>}</div>
              <div className={`tt-public-profile-identity font-${profile?.fontFamily || "space"} name-${profile?.nameSize || "large"}`}>
                <div><h2>{displayName}</h2><span>@{username}</span></div>
                <p>{profile?.bio || "No bio added yet."}</p>
                {links.length > 0 && <div className="tt-profile-links">{links.map(([label, url]) => <a key={label} href={url} target="_blank" rel="noopener noreferrer">{label} ↗</a>)}</div>}
              </div>
              {profile?.badgeText && <span className="tt-public-profile-badge">{profile.badgeText}</span>}
              <div className="tt-profile-stats">{stats.map(stat => <div className="tt-profile-stat" key={stat.label}><strong>{stat.value}</strong><span>{stat.label}</span></div>)}</div>
            </div>
          </div>
          <div className="tt-public-profile-tabs" role="tablist" aria-label="Profile content">{["Posts", "Reposts", "Communities"].map(tab => <button key={tab} type="button" role="tab" aria-selected={activeTab === tab} className={activeTab === tab ? "selected" : ""} onClick={() => setActiveTab(tab)}>{tab}</button>)}</div>
          <div className="tt-profile-empty"><span>{activeTab === "Communities" ? "◈" : "▤"}</span><h2>No {activeTab.toLowerCase()} yet</h2><p>{activeTab === "Communities" ? "Communities this member joins will appear here." : "When you share something on TrenchTalk, it will appear here."}</p><button type="button" onClick={() => onNavigate("explore")}>Explore TrenchTalk</button></div>
        </section>
      </main>
    </div>
  );
}
