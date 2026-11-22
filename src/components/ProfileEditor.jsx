import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  query,
  setDoc,
  doc,
  where,
} from "firebase/firestore";

import { db } from "../firebase";
import { uploadProfileImage } from "../Services/cloudinaryService";

const DEFAULT_ACCENT = "#b9d85a";

export default function ProfileEditor({ user, profile, onProfileUpdated, onNavigate, onLogout }) {
  const [form, setForm] = useState({
    displayName: "",
    username: "",
    bio: "",
    accentColor: DEFAULT_ACCENT,
    avatarUrl: "",
    bannerUrl: "",
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setForm({
      displayName: profile?.displayName || user?.displayName || "",
      username: profile?.username || user?.email?.split("@")[0] || "",
      bio: profile?.bio || "",
      accentColor: profile?.accentColor || DEFAULT_ACCENT,
      avatarUrl: profile?.avatarUrl || "",
      bannerUrl: profile?.bannerUrl || "",
    });
  }, [profile, user]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleImageUpload(event, type) {
    const file = event.target.files?.[0];
    if (!file) return;

    setMessage("");
    setUploading(type);

    try {
      const result = await uploadProfileImage(file, type);
      updateField(type === "avatar" ? "avatarUrl" : "bannerUrl", result.url);
      setMessage(`${type === "avatar" ? "Profile picture" : "Banner"} uploaded. Remember to save your changes.`);
    } catch (error) {
      console.error("Profile image upload failed:", error);
      setMessage(error.message || "Image upload failed.");
    } finally {
      setUploading("");
      event.target.value = "";
    }
  }

  async function checkUsername(username) {
    const snapshot = await getDocs(
      query(collection(db, "users"), where("username", "==", username))
    );
    return snapshot.docs.some((document) => document.id !== user.uid);
  }

  async function handleSave(event) {
    event.preventDefault();
    if (!user?.uid) return;

    const displayName = form.displayName.trim();
    const username = form.username.trim().toLowerCase();
    const bio = form.bio.trim();

    if (!displayName) return setMessage("Please enter a display name.");
    if (!/^[a-z0-9_]{3,20}$/.test(username)) {
      return setMessage("Username must be 3–20 characters and contain only letters, numbers and underscores.");
    }
    if (bio.length > 160) return setMessage("Your bio cannot exceed 160 characters.");

    setSaving(true);
    setMessage("");

    try {
      if (await checkUsername(username)) {
        setMessage("That username is already taken.");
        return;
      }

      const updatedProfile = {
        displayName,
        username,
        bio,
        accentColor: form.accentColor,
        avatarUrl: form.avatarUrl,
        bannerUrl: form.bannerUrl,
        updatedAt: new Date().toISOString(),
      };

      await setDoc(doc(db, "users", user.uid), updatedProfile, { merge: true });
      onProfileUpdated?.({ ...profile, ...updatedProfile });
      setMessage("Your profile has been saved.");
    } catch (error) {
      console.error("Profile save failed:", error);
      setMessage("Could not save your profile. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="ttpe-layout">
      <aside className="ttpe-sidebar">
        <div className="ttpe-sidebar-heading">USER SETTINGS</div>
        <button type="button" className="ttpe-nav-item" onClick={() => onNavigate?.("profile")}>
          <span className="ttpe-nav-icon">◉</span>
          My Profile
        </button>
        <button type="button" className="ttpe-nav-item active" onClick={() => onNavigate?.("profile-customisation")}>
          <span className="ttpe-nav-icon">✳</span>
          Profile Customisation
        </button>
        <div className="ttpe-sidebar-divider" />
        <div className="ttpe-sidebar-account">
          <div className="ttpe-sidebar-avatar">
            {form.avatarUrl ? <img src={form.avatarUrl} alt="" /> : (form.displayName?.[0]?.toUpperCase() || "T")}
          </div>
          <div className="ttpe-sidebar-account-info">
            <strong>{form.displayName || "Your account"}</strong>
            <span>@{form.username || "username"}</span>
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
        <header className="ttpe-header">
          <div>
            <span className="ttpe-eyebrow">USER SETTINGS</span>
            <h1>Profile Customisation</h1>
            <p>Personalise how other people see you across TrenchTalk.</p>
          </div>
        </header>

        <section className="ttpe-section">
          <div className="ttpe-section-heading">
            <div>
              <h2>Live profile preview</h2>
              <p>Your changes will appear here before you save them.</p>
            </div>
          </div>

          <div className="ttpe-preview-card">
            <div
              className="ttpe-banner"
              style={{
                backgroundColor: form.accentColor,
                backgroundImage: form.bannerUrl ? `url(${form.bannerUrl})` : "none",
              }}
            >
              <label className="ttpe-banner-button">
                {uploading === "banner" ? "Uploading..." : "Change banner"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={(event) => handleImageUpload(event, "banner")}
                  disabled={Boolean(uploading)}
                />
              </label>
            </div>

            <div className="ttpe-preview-content">
              <div className="ttpe-avatar-container">
                <div className="ttpe-avatar">
                  {form.avatarUrl ? <img src={form.avatarUrl} alt="Profile avatar" /> : <span>{form.displayName?.[0]?.toUpperCase() || "T"}</span>}
                </div>
                <label className="ttpe-avatar-button">
                  {uploading === "avatar" ? "Uploading..." : "Change avatar"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={(event) => handleImageUpload(event, "avatar")}
                    disabled={Boolean(uploading)}
                  />
                </label>
              </div>
              <div className="ttpe-preview-identity">
                <h2>{form.displayName || "Your name"}</h2>
                <span>@{form.username || "username"}</span>
                {form.bio && <p>{form.bio}</p>}
              </div>
              <div className="ttpe-preview-badge">TRENCHTALK MEMBER</div>
            </div>
          </div>
        </section>

        <section className="ttpe-section">
          <div className="ttpe-section-heading">
            <div>
              <h2>Profile details</h2>
              <p>Update your public identity and appearance.</p>
            </div>
          </div>

          <form className="ttpe-form-card" onSubmit={handleSave}>
            <div className="ttpe-field">
              <label htmlFor="ttpe-display-name">DISPLAY NAME</label>
              <input
                id="ttpe-display-name"
                type="text"
                value={form.displayName}
                onChange={(event) => updateField("displayName", event.target.value)}
                maxLength={40}
                placeholder="Your display name"
              />
              <small>This is the name other users will see.</small>
            </div>

            <div className="ttpe-field">
              <label htmlFor="ttpe-username">USERNAME</label>
              <div className="ttpe-username-input">
                <span>@</span>
                <input
                  id="ttpe-username"
                  type="text"
                  value={form.username}
                  onChange={(event) => updateField("username", event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                  maxLength={20}
                  placeholder="username"
                />
              </div>
              <small>3–20 characters. Letters, numbers and underscores only.</small>
            </div>

            <div className="ttpe-field">
              <div className="ttpe-label-row">
                <label htmlFor="ttpe-bio">ABOUT ME</label>
                <span>{form.bio.length}/160</span>
              </div>
              <textarea
                id="ttpe-bio"
                value={form.bio}
                onChange={(event) => updateField("bio", event.target.value)}
                maxLength={160}
                placeholder="Tell people a little about yourself..."
                rows={4}
              />
              <small>Add a short description to your profile.</small>
            </div>

            <div className="ttpe-field">
              <label htmlFor="ttpe-accent">PROFILE ACCENT COLOUR</label>
              <div className="ttpe-colour-picker">
                <div className="ttpe-colour-preview">
                  <input
                    id="ttpe-accent"
                    type="color"
                    value={form.accentColor}
                    onChange={(event) => updateField("accentColor", event.target.value)}
                  />
                </div>
                <div className="ttpe-colour-value">
                  <strong>{form.accentColor.toUpperCase()}</strong>
                  <span>Your profile accent colour</span>
                </div>
                <button type="button" className="ttpe-reset-button" onClick={() => updateField("accentColor", DEFAULT_ACCENT)}>
                  Reset
                </button>
              </div>
            </div>

            {message && (
              <div
                className={`ttpe-message ${message.includes("saved") || message.includes("uploaded") ? "success" : "error"}`}
                role="status"
                aria-live="polite"
              >
                {message}
              </div>
            )}

            <div className="ttpe-save-row">
              <div>
                <strong>Profile changes</strong>
                <span>Remember to save your changes.</span>
              </div>
              <button type="submit" className="ttpe-save-button" disabled={saving || Boolean(uploading)}>
                {saving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
