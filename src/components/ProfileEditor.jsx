import { useEffect, useState } from "react";
import { collection, getDocs, query, setDoc, doc, where } from "firebase/firestore";
import { db } from "../firebase";
import { uploadProfileImage } from "../Services/cloudinaryService";

const DEFAULT_ACCENT = "#b9d85a";
const DEFAULTS = { displayName: "", username: "", bio: "", accentColor: DEFAULT_ACCENT, avatarUrl: "", bannerUrl: "", profileTheme: "minimal" };

export default function ProfileEditor({ user, profile, onProfileUpdated, onNavigate, onLogout }) {
  const [form, setForm] = useState(DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setForm({
      ...DEFAULTS,
      displayName: profile?.displayName || user?.displayName || "",
      username: profile?.username || user?.email?.split("@")[0] || "",
      bio: profile?.bio || "",
      accentColor: profile?.accentColor || DEFAULT_ACCENT,
      avatarUrl: profile?.avatarUrl || "",
      bannerUrl: profile?.bannerUrl || "",
      profileTheme: profile?.profileTheme || "minimal",
    });
  }, [profile, user]);

  const updateField = (field, value) => setForm(current => ({ ...current, [field]: value }));

  async function handleImageUpload(event, type) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { setMessage("Images must be smaller than 8 MB."); event.target.value = ""; return; }
    setMessage(""); setUploading(type);
    try {
      const result = await uploadProfileImage(file, type);
      updateField(type === "avatar" ? "avatarUrl" : "bannerUrl", result.url);
      setMessage(`${type === "avatar" ? "Profile picture" : "Banner"} uploaded. Save to publish it.`);
    } catch (error) {
      console.error("Profile image upload failed:", error);
      setMessage(error.message || "Image upload failed.");
    } finally { setUploading(""); event.target.value = ""; }
  }

  async function handleSave(event) {
    event.preventDefault();
    if (!user?.uid) { setMessage("You must be signed in to save your profile."); return; }
    const displayName = form.displayName.trim();
    const username = form.username.trim().toLowerCase();
    const bio = form.bio.trim();
    if (!displayName) return setMessage("Please enter a display name.");
    if (!/^[a-z0-9_]{3,20}$/.test(username)) return setMessage("Username must be 3–20 characters and contain only letters, numbers and underscores.");
    if (bio.length > 160) return setMessage("Your bio cannot exceed 160 characters.");
    setSaving(true); setMessage("");
    try {
      // Client-side uniqueness check. For production-grade guarantees, enforce username claims transactionally/server-side.
      const snapshot = await getDocs(query(collection(db, "users"), where("username", "==", username)));
      const taken = snapshot.docs.some(entry => entry.id !== user.uid);
      if (taken) { setMessage("That username is already taken."); return; }
      const updatedProfile = {
        displayName, username, bio,
        accentColor: form.accentColor,
        avatarUrl: form.avatarUrl,
        bannerUrl: form.bannerUrl,
        profileTheme: form.profileTheme,
        updatedAt: new Date().toISOString(),
      };
      await setDoc(doc(db, "users", user.uid), updatedProfile, { merge: true });
      onProfileUpdated?.({ ...(profile || {}), ...updatedProfile });
      setMessage("Your profile has been saved.");
    } catch (error) {
      console.error("Profile save failed:", error);
      setMessage("Could not save your profile. Please try again.");
    } finally { setSaving(false); }
  }

  return <div className="ttpe-layout">
    <aside className="ttpe-sidebar">
      <div className="ttpe-sidebar-heading">USER SETTINGS</div>
      <button type="button" className="ttpe-nav-item" onClick={() => onNavigate?.("profile")}><span className="ttpe-nav-icon">◉</span>My Profile</button>
      <button type="button" className="ttpe-nav-item active" onClick={() => onNavigate?.("profile-customisation")}><span className="ttpe-nav-icon">✳</span>Profile Customisation</button>
      <div className="ttpe-sidebar-divider" />
      <div className="ttpe-sidebar-account"><div className="ttpe-sidebar-avatar">{form.avatarUrl ? <img src={form.avatarUrl} alt="" /> : (form.displayName?.[0]?.toUpperCase() || "T")}</div><div className="ttpe-sidebar-account-info"><strong>{form.displayName || "Your account"}</strong><span>@{form.username || "username"}</span></div></div>
      <div className="ttpe-sidebar-actions"><button type="button" className="ttpe-add-account" onClick={() => window.dispatchEvent(new Event("tt-open-add-account"))}><span>+</span><span className="ttpe-add-account-label">Add another account</span></button><button type="button" className="ttpe-logout-button" onClick={onLogout}>Log out</button></div>
    </aside>
    <main className="ttpe-main">
      <header className="ttpe-header"><div><span className="ttpe-eyebrow">USER SETTINGS</span><h1>Profile Customisation</h1><p>Personalise how other people see you across TrenchTalk.</p></div></header>
      <section className="ttpe-section"><div className="ttpe-section-heading"><div><h2>Live profile preview</h2><p>Your changes appear here before you save them.</p></div></div>
        <div className={`ttpe-preview-card theme-${form.profileTheme}`} style={{ "--profile-accent": form.accentColor }}>
          <div className="ttpe-banner" style={{ backgroundColor: form.accentColor, backgroundImage: form.bannerUrl ? `url(${form.bannerUrl})` : "none" }}><label className="ttpe-banner-button">{uploading === "banner" ? "Uploading..." : "Change banner"}<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={e => handleImageUpload(e,"banner")} disabled={Boolean(uploading)} /></label></div>
          <div className="ttpe-preview-content"><div className="ttpe-avatar-container"><div className="ttpe-avatar">{form.avatarUrl ? <img src={form.avatarUrl} alt="Profile avatar" /> : <span>{form.displayName?.[0]?.toUpperCase() || "T"}</span>}</div><label className="ttpe-avatar-button">{uploading === "avatar" ? "Uploading..." : "Change avatar"}<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={e => handleImageUpload(e,"avatar")} disabled={Boolean(uploading)} /></label></div>
            <div className="ttpe-preview-identity"><h2>{form.displayName || "Your name"}</h2><span>@{form.username || "username"}</span>{form.bio && <p>{form.bio}</p>}</div><div className="ttpe-preview-badge">TRENCHTALK MEMBER</div></div>
        </div>
      </section>
      <section className="ttpe-section"><div className="ttpe-section-heading"><div><h2>Profile details</h2><p>Update your public identity and appearance.</p></div></div>
        <form className="ttpe-form-card" onSubmit={handleSave}>
          <div className="ttpe-field"><label htmlFor="ttpe-display-name">DISPLAY NAME</label><input id="ttpe-display-name" value={form.displayName} onChange={e => updateField("displayName",e.target.value)} maxLength={40} placeholder="Your display name" /><small>This is the name other users will see.</small></div>
          <div className="ttpe-field"><label htmlFor="ttpe-username">USERNAME</label><div className="ttpe-username-input"><span>@</span><input id="ttpe-username" value={form.username} onChange={e => updateField("username",e.target.value.toLowerCase().replace(/[^a-z0-9_]/g,""))} maxLength={20} placeholder="username" /></div><small>3–20 characters. Letters, numbers and underscores only.</small></div>
          <div className="ttpe-field"><div className="ttpe-label-row"><label htmlFor="ttpe-bio">ABOUT ME</label><span>{form.bio.length}/160</span></div><textarea id="ttpe-bio" value={form.bio} onChange={e => updateField("bio",e.target.value)} maxLength={160} rows={4} placeholder="Tell people a little about yourself..." /><small>Add a short description to your profile.</small></div>
          <div className="ttpe-field"><label htmlFor="ttpe-accent">PROFILE ACCENT COLOUR</label><div className="ttpe-colour-picker"><div className="ttpe-colour-preview"><input id="ttpe-accent" type="color" value={form.accentColor} onChange={e => updateField("accentColor",e.target.value)} /></div><div className="ttpe-colour-value"><strong>{form.accentColor.toUpperCase()}</strong><span>Your profile accent colour</span></div><button type="button" className="ttpe-reset-button" onClick={() => updateField("accentColor",DEFAULT_ACCENT)}>Reset</button></div></div>
          <div className="ttpe-field"><label htmlFor="ttpe-theme">PROFILE STYLE</label><select id="ttpe-theme" value={form.profileTheme} onChange={e => updateField("profileTheme",e.target.value)}><option value="minimal">Minimal</option><option value="glow">Accent glow</option><option value="outline">Accent outline</option></select><small>Choose how your profile card is presented.</small></div>
          {message && <div className={`ttpe-message ${/saved|uploaded/i.test(message) ? "success" : "error"}`} role="status" aria-live="polite">{message}</div>}
          <div className="ttpe-save-row"><div><strong>Profile changes</strong><span>Changes are published when you save.</span></div><button type="submit" className="ttpe-save-button" disabled={saving || Boolean(uploading)}>{saving ? "Saving..." : "Save changes"}</button></div>
        </form>
      </section>
    </main>
  </div>;
}
