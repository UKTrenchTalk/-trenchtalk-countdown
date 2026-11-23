import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, query, setDoc, doc, where } from "firebase/firestore";
import { db } from "../firebase";
import { uploadProfileImage } from "../Services/cloudinaryService";

const DEFAULT_ACCENT = "#b9d85a";
const DEFAULTS = {
  displayName: "", username: "", bio: "", accentColor: DEFAULT_ACCENT,
  avatarUrl: "", bannerUrl: "", profileTheme: "minimal", cardColor: "#e4eadc",
  borderColor: "#bac8ae", nameColor: "#263827", nameSize: "large",
  fontFamily: "space", avatarShape: "circle", avatarSize: "large",
  avatarBorderColor: "#e4eadc", bannerHeight: "220", bannerPosition: "center",
  profileLayout: "standard", decoration: "none", badgeText: "", website: "", twitter: "", telegram: ""
};
const COLOR_FIELDS = [
  ["accentColor", "Accent colour", "Used for highlights and the banner fallback."],
  ["cardColor", "Profile card colour", "Background behind your profile identity."],
  ["borderColor", "Card border colour", "Outline around your profile card."],
  ["nameColor", "Display name colour", "Colour of your public display name."],
  ["avatarBorderColor", "Avatar border colour", "Outline around your avatar."]
];

export default function ProfileEditor({ user, profile, onProfileUpdated, onNavigate, onLogout }) {
  const [form, setForm] = useState(DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    setForm(current => ({ ...DEFAULTS, ...current, ...(profile || {}),
      displayName: profile?.displayName || user?.displayName || "",
      username: profile?.username || user?.email?.split("@")[0] || "" }));
  }, [profile, user]);
  const updateField = (field, value) => setForm(current => ({ ...current, [field]: value }));
  const previewStyle = useMemo(() => ({
    "--profile-accent": form.accentColor, "--profile-card": form.cardColor,
    "--profile-border": form.borderColor, "--profile-name": form.nameColor,
    "--profile-avatar-border": form.avatarBorderColor,
    "--profile-banner-height": `${Math.min(360, Math.max(100, Number(form.bannerHeight) || 220))}px`
  }), [form]);
  async function handleImageUpload(event, type) {
    const file = event.target.files?.[0]; if (!file) return;
    if (file.size > 8 * 1024 * 1024) { setMessage("Images must be smaller than 8 MB."); event.target.value = ""; return; }
    setMessage(""); setUploading(type);
    try { const result = await uploadProfileImage(file, type); updateField(type === "avatar" ? "avatarUrl" : "bannerUrl", result.url); setMessage(`${type === "avatar" ? "Avatar" : "Banner"} uploaded. Save to publish it.`); }
    catch (error) { console.error("Profile image upload failed:", error); setMessage(error.message || "Image upload failed."); }
    finally { setUploading(""); event.target.value = ""; }
  }
  async function handleSave(event) {
    event.preventDefault();
    if (!user?.uid) { setMessage("You must be signed in to save your profile."); return; }
    const displayName = form.displayName.trim(); const username = form.username.trim().toLowerCase(); const bio = form.bio.trim();
    if (!displayName) { setMessage("Please enter a display name."); return; }
    if (!/^[a-z0-9_]{3,20}$/.test(username)) { setMessage("Username must be 3–20 characters and contain only letters, numbers and underscores."); return; }
    if (bio.length > 160) { setMessage("Your bio cannot exceed 160 characters."); return; }
    setSaving(true); setMessage("");
    try {
      const snapshot = await getDocs(query(collection(db, "users"), where("username", "==", username)));
      if (snapshot.docs.some(entry => entry.id !== user.uid)) { setMessage("That username is already taken."); return; }
      const updatedProfile = { ...form, displayName, username, bio,
        bannerHeight: Math.min(360, Math.max(100, Number(form.bannerHeight) || 220)),
        updatedAt: new Date().toISOString() };
      await setDoc(doc(db, "users", user.uid), updatedProfile, { merge: true });
      onProfileUpdated?.({ ...(profile || {}), ...updatedProfile }); setMessage("Your profile customisation has been saved.");
    } catch (error) { console.error("Profile save failed:", error); setMessage("Could not save your profile. Please try again."); }
    finally { setSaving(false); }
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
      <header className="ttpe-header"><div><span className="ttpe-eyebrow">YOUR IDENTITY</span><h1>Profile Customisation</h1><p>Control the details, layout and appearance of your public profile.</p></div></header>
      <section className="ttpe-section"><div className="ttpe-section-heading"><div><h2>Live profile preview</h2><p>Preview updates as you customise. Save to publish them.</p></div></div>
        <div className={`ttpe-preview-card theme-${form.profileTheme} layout-${form.profileLayout} decoration-${form.decoration}`} style={previewStyle}>
          <div className="ttpe-banner" style={{ backgroundColor: form.accentColor, backgroundImage: form.bannerUrl ? `url(${form.bannerUrl})` : "none", backgroundPosition: form.bannerPosition, height: `clamp(100px, ${form.bannerHeight}px, 360px)` }}><label className="ttpe-banner-button">{uploading === "banner" ? "Uploading…" : "Upload banner"}<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={e => handleImageUpload(e,"banner")} disabled={Boolean(uploading)} /></label></div>
          <div className="ttpe-preview-content"><div className={`ttpe-avatar-container avatar-${form.avatarSize}`}><div className={`ttpe-avatar shape-${form.avatarShape}`}>{form.avatarUrl ? <img src={form.avatarUrl} alt="Profile avatar" /> : <span>{form.displayName?.[0]?.toUpperCase() || "T"}</span>}</div><label className="ttpe-avatar-button">{uploading === "avatar" ? "Uploading…" : "Upload avatar"}<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={e => handleImageUpload(e,"avatar")} disabled={Boolean(uploading)} /></label></div>
            <div className={`ttpe-preview-identity name-${form.nameSize}`}><h2>{form.displayName || "Your name"}</h2><span>@{form.username || "username"}</span><p>{form.bio || "Your bio will appear here."}</p></div>
            {form.badgeText && <span className="ttpe-preview-badge">{form.badgeText}</span>}
          </div>
        </div>
      </section>
      <form className="ttpe-form-card ttpe-advanced-form" onSubmit={handleSave}>
        <section className="ttpe-settings-group"><div className="ttpe-section-heading"><div><h2>Identity</h2><p>Your public name and account details.</p></div></div>
          <div className="ttpe-field"><label htmlFor="ttpe-display-name">DISPLAY NAME</label><input id="ttpe-display-name" value={form.displayName} onChange={e => updateField("displayName",e.target.value)} maxLength={40} placeholder="Your display name" /></div>
          <div className="ttpe-field"><label htmlFor="ttpe-username">USERNAME</label><div className="ttpe-username-input"><span>@</span><input id="ttpe-username" value={form.username} onChange={e => updateField("username",e.target.value.toLowerCase().replace(/[^a-z0-9_]/g,""))} maxLength={20} placeholder="username" /></div><small>3–20 characters. Letters, numbers and underscores only.</small></div>
          <div className="ttpe-field"><div className="ttpe-label-row"><label htmlFor="ttpe-bio">ABOUT ME</label><span>{form.bio.length}/160</span></div><textarea id="ttpe-bio" value={form.bio} onChange={e => updateField("bio",e.target.value)} maxLength={160} rows={3} placeholder="Tell people a little about yourself…" /></div>
        </section>
        <section className="ttpe-settings-group"><div className="ttpe-section-heading"><div><h2>Profile artwork</h2><p>Upload and position your profile images.</p></div></div>
          <div className="ttpe-field"><label>BANNER POSITION</label><select value={form.bannerPosition} onChange={e => updateField("bannerPosition",e.target.value)}><option value="center">Centre</option><option value="top">Top</option><option value="bottom">Bottom</option><option value="left">Left</option><option value="right">Right</option></select></div>
          <div className="ttpe-field"><label htmlFor="ttpe-banner-height">BANNER HEIGHT · {form.bannerHeight}px</label><input id="ttpe-banner-height" type="range" min="100" max="360" step="10" value={form.bannerHeight} onChange={e => updateField("bannerHeight",e.target.value)} /></div>
          <div className="ttpe-field"><label>AVATAR SHAPE</label><div className="ttpe-choice-row">{[["circle","Circle"],["rounded","Rounded"],["square","Square"]].map(([v,l])=><button type="button" key={v} className={form.avatarShape===v?"selected":""} onClick={()=>updateField("avatarShape",v)}>{l}</button>)}</div></div>
          <div className="ttpe-field"><label>AVATAR SIZE</label><div className="ttpe-choice-row">{[["small","Small"],["medium","Medium"],["large","Large"]].map(([v,l])=><button type="button" key={v} className={form.avatarSize===v?"selected":""} onClick={()=>updateField("avatarSize",v)}>{l}</button>)}</div></div>
        </section>
        <section className="ttpe-settings-group"><div className="ttpe-section-heading"><div><h2>Appearance</h2><p>Fine-tune the colours, typography and card treatment.</p></div></div>
          {COLOR_FIELDS.map(([field,label,help])=><div className="ttpe-field" key={field}><label htmlFor={`ttpe-${field}`}>{label.toUpperCase()}</label><div className="ttpe-colour-picker"><div className="ttpe-colour-preview"><input id={`ttpe-${field}`} type="color" value={form[field]} onChange={e=>updateField(field,e.target.value)} /></div><div className="ttpe-colour-value"><strong>{form[field].toUpperCase()}</strong><span>{help}</span></div></div></div>)}
          <div className="ttpe-field"><label>PROFILE CARD STYLE</label><div className="ttpe-choice-row">{[["minimal","Minimal"],["glow","Soft glow"],["outline","Accent outline"]].map(([v,l])=><button type="button" key={v} className={form.profileTheme===v?"selected":""} onClick={()=>updateField("profileTheme",v)}>{l}</button>)}</div></div>
          <div className="ttpe-field"><label>PROFILE LAYOUT</label><div className="ttpe-choice-row">{[["standard","Standard"],["compact","Compact"],["wide","Wide identity"]].map(([v,l])=><button type="button" key={v} className={form.profileLayout===v?"selected":""} onClick={()=>updateField("profileLayout",v)}>{l}</button>)}</div></div>
          <div className="ttpe-field"><label>DISPLAY NAME SIZE</label><div className="ttpe-choice-row">{[["small","Small"],["medium","Medium"],["large","Large"]].map(([v,l])=><button type="button" key={v} className={form.nameSize===v?"selected":""} onClick={()=>updateField("nameSize",v)}>{l}</button>)}</div></div>
          <div className="ttpe-field"><label>TYPEFACE</label><select value={form.fontFamily} onChange={e=>updateField("fontFamily",e.target.value)}><option value="space">Space Grotesk</option><option value="dm">DM Sans</option><option value="serif">Serif</option><option value="mono">Monospace</option></select></div>
        </section>
        <section className="ttpe-settings-group"><div className="ttpe-section-heading"><div><h2>Decorations & links</h2><p>Add a subtle profile treatment and public links.</p></div></div>
          <div className="ttpe-field"><label>PROFILE DECORATION</label><div className="ttpe-choice-row">{[["none","None"],["ring","Accent ring"],["spark","Spark"],["terminal","Terminal"]].map(([v,l])=><button type="button" key={v} className={form.decoration===v?"selected":""} onClick={()=>updateField("decoration",v)}>{l}</button>)}</div></div>
          <div className="ttpe-field"><label htmlFor="ttpe-badge">PROFILE LABEL</label><input id="ttpe-badge" value={form.badgeText} onChange={e=>updateField("badgeText",e.target.value)} maxLength={28} placeholder="e.g. Founder, Trader, Builder" /><small>Optional short label shown on your profile.</small></div>
          <div className="ttpe-field"><label htmlFor="ttpe-website">WEBSITE</label><input id="ttpe-website" type="url" value={form.website} onChange={e=>updateField("website",e.target.value)} placeholder="https://example.com" /></div>
          <div className="ttpe-field"><label htmlFor="ttpe-twitter">X / TWITTER URL</label><input id="ttpe-twitter" type="url" value={form.twitter} onChange={e=>updateField("twitter",e.target.value)} placeholder="https://x.com/username" /></div>
          <div className="ttpe-field"><label htmlFor="ttpe-telegram">TELEGRAM URL</label><input id="ttpe-telegram" type="url" value={form.telegram} onChange={e=>updateField("telegram",e.target.value)} placeholder="https://t.me/username" /></div>
        </section>
        {message && <div className={`ttpe-message ${/saved|uploaded/i.test(message)?"success":"error"}`} role="status" aria-live="polite">{message}</div>}
        <div className="ttpe-save-row"><div><strong>Publish your profile</strong><span>All customisation settings are saved to your TrenchTalk account.</span></div><button type="submit" className="ttpe-save-button" disabled={saving||Boolean(uploading)}>{saving?"Saving…":"Save changes"}</button></div>
      </form>
    </main>
  </div>;
}
