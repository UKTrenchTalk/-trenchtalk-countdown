import { useEffect, useMemo, useState } from "react";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { uploadProfileImage } from "../Services/cloudinaryService";

const DEFAULT_ACCENT = "#b9d85a";

const DEFAULTS = {
  displayName: "",
  username: "",
  bio: "",
  accentColor: DEFAULT_ACCENT,
  avatarUrl: "",
  bannerUrl: "",
  profileTheme: "minimal",
  cardColor: "#e4eadc",
  borderColor: "#bac8ae",
  nameColor: "#263827",
  nameSize: "large",
  fontFamily: "space",
  avatarShape: "circle",
  avatarSize: "large",
  avatarBorderColor: "#e4eadc",
  bannerHeight: 220,
  bannerPosition: "center",
  profileLayout: "standard",
  decoration: "none",
  badgeText: "",
  website: "",
  twitter: "",
  telegram: ""
};

const COLOR_FIELDS = [
  ["accentColor", "Accent colour"],
  ["cardColor", "Profile card colour"],
  ["borderColor", "Card border colour"],
  ["nameColor", "Display name colour"],
  ["avatarBorderColor", "Avatar border colour"]
];

export default function ProfileEditor({
  user,
  profile,
  onProfileUpdated,
  onNavigate,
  onLogout
}) {
  const [form, setForm] = useState(DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setForm({
      ...DEFAULTS,
      ...(profile || {}),
      displayName:
        profile?.displayName || user?.displayName || "",
      username:
        profile?.username || user?.email?.split("@")[0] || ""
    });
  }, [profile, user]);

  const updateField = (field, value) => {
    setForm(current => ({
      ...current,
      [field]: value
    }));
  };

  const previewStyle = useMemo(() => ({
    "--profile-accent": form.accentColor,
    "--profile-card": form.cardColor,
    "--profile-border": form.borderColor,
    "--profile-name": form.nameColor,
    "--profile-avatar-border": form.avatarBorderColor
  }), [form]);

  async function handleImageUpload(event, type) {
    const file = event.target.files?.[0];

    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      setMessage("Images must be smaller than 8 MB.");
      event.target.value = "";
      return;
    }

    setMessage("");
    setUploading(type);

    try {
      const result = await uploadProfileImage(file, type);

      updateField(
        type === "avatar" ? "avatarUrl" : "bannerUrl",
        result.url
      );

      setMessage(
        `${type === "avatar" ? "Avatar" : "Banner"} uploaded. Save to publish it.`
      );
    } catch (error) {
      console.error("Profile image upload failed:", error);
      setMessage(error.message || "Image upload failed.");
    } finally {
      setUploading("");
      event.target.value = "";
    }
  }

  async function handleSave(event) {
    event.preventDefault();

    if (!user?.uid) {
      setMessage("You must be signed in to save your profile.");
      return;
    }

    const displayName = form.displayName.trim();
    const username = form.username.trim().toLowerCase();
    const bio = form.bio.trim();

    if (!displayName) {
      setMessage("Please enter a display name.");
      return;
    }

    if (!/^[a-z0-9_]{3,20}$/.test(username)) {
      setMessage("Your existing username is invalid.");
      return;
    }

    if (bio.length > 160) {
      setMessage("Your bio cannot exceed 160 characters.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const updatedProfile = {
        ...form,
        displayName,
        username,
        bio,
        bannerHeight: Math.min(
          360,
          Math.max(100, Number(form.bannerHeight) || 220)
        ),
        updatedAt: serverTimestamp()
      };

      await setDoc(doc(db, "users", user.uid), updatedProfile, { merge: true });

      // Publish only explicitly public profile fields. Never copy email or account metadata.
      const publicProfile = {
        uid: user.uid,
        displayName,
        username,
        bio,
        avatarUrl: updatedProfile.avatarUrl || "",
        bannerUrl: updatedProfile.bannerUrl || "",
        accentColor: updatedProfile.accentColor || DEFAULT_ACCENT,
        cardColor: updatedProfile.cardColor || "#e4eadc",
        borderColor: updatedProfile.borderColor || "#bac8ae",
        nameColor: updatedProfile.nameColor || "#263827",
        nameSize: updatedProfile.nameSize || "large",
        fontFamily: updatedProfile.fontFamily || "space",
        avatarShape: updatedProfile.avatarShape || "circle",
        avatarSize: updatedProfile.avatarSize || "large",
        avatarBorderColor: updatedProfile.avatarBorderColor || "#e4eadc",
        bannerHeight: updatedProfile.bannerHeight || 220,
        bannerPosition: updatedProfile.bannerPosition || "center",
        profileTheme: updatedProfile.profileTheme || "minimal",
        profileLayout: updatedProfile.profileLayout || "standard",
        decoration: updatedProfile.decoration || "none",
        badgeText: updatedProfile.badgeText || "",
        website: updatedProfile.website || "",
        twitter: updatedProfile.twitter || "",
        telegram: updatedProfile.telegram || "",
        updatedAt: serverTimestamp()
      };
      await setDoc(doc(db, "publicProfiles", user.uid), publicProfile, { merge: true });

      // Update the main React profile state immediately.
      onProfileUpdated?.({
        ...(profile || {}),
        ...updatedProfile,
        updatedAt: new Date().toISOString()
      });

      setMessage("Your profile has been saved successfully.");
    } catch (error) {
      console.error("Profile save failed:", error);

      setMessage(
        error.code
          ? `Save failed (${error.code}): ${error.message}`
          : error.message || "Could not save your profile."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="ttpe-layout">

      <aside className="ttpe-sidebar">
        <div className="ttpe-sidebar-heading">
          USER SETTINGS
        </div>

        <button
          type="button"
          className="ttpe-nav-item"
          onClick={() => onNavigate?.("profile")}
        >
          <span className="ttpe-nav-icon">◉</span>
          My Profile
        </button>

        <button
          type="button"
          className="ttpe-nav-item active"
          onClick={() => onNavigate?.("profile-customisation")}
        >
          <span className="ttpe-nav-icon">✳</span>
          Profile Customisation
        </button>

        <div className="ttpe-sidebar-divider" />

        <div className="ttpe-sidebar-account">
          <div className="ttpe-sidebar-avatar">
            {form.avatarUrl ? (
              <img src={form.avatarUrl} alt="" />
            ) : (
              form.displayName?.[0]?.toUpperCase() || "T"
            )}
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
            onClick={() =>
              window.dispatchEvent(new Event("tt-open-add-account"))
            }
          >
            <span>+</span>
            <span className="ttpe-add-account-label">
              Add another account
            </span>
          </button>

          <button
            type="button"
            className="ttpe-logout-button"
            onClick={onLogout}
          >
            Log out
          </button>
        </div>
      </aside>

      <main className="ttpe-main">

        <header className="ttpe-header">
          <div>
            <span className="ttpe-eyebrow">YOUR IDENTITY</span>
            <h1>Profile Customisation</h1>
            <p>
              Make your TrenchTalk profile your own.
            </p>
          </div>
        </header>

        <section className="ttpe-section">

          <div className="ttpe-section-heading">
            <div>
              <h2>Live profile preview</h2>
              <p>
                Your changes appear here before you publish them.
              </p>
            </div>
          </div>

          <div
            className={`ttpe-preview-card theme-${form.profileTheme} layout-${form.profileLayout} decoration-${form.decoration}`}
            style={previewStyle}
          >
            <div
              className="ttpe-banner"
              style={{
                backgroundColor: form.accentColor,
                backgroundImage: form.bannerUrl
                  ? `url(${form.bannerUrl})`
                  : "none",
                backgroundPosition: form.bannerPosition,
                height: `${form.bannerHeight}px`
              }}
            >
              <label className="ttpe-banner-button">
                {uploading === "banner"
                  ? "Uploading..."
                  : "Upload banner"}

                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={e => handleImageUpload(e, "banner")}
                  disabled={Boolean(uploading)}
                />
              </label>
            </div>

            <div className="ttpe-preview-content">

              <div
                className={`ttpe-avatar-container avatar-${form.avatarSize}`}
              >
                <div
                  className={`ttpe-avatar shape-${form.avatarShape}`}
                >
                  {form.avatarUrl ? (
                    <img src={form.avatarUrl} alt="Profile avatar" />
                  ) : (
                    <span>
                      {form.displayName?.[0]?.toUpperCase() || "T"}
                    </span>
                  )}
                </div>

                <label className="ttpe-avatar-button">
                  {uploading === "avatar"
                    ? "Uploading..."
                    : "Upload avatar"}

                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={e => handleImageUpload(e, "avatar")}
                    disabled={Boolean(uploading)}
                  />
                </label>
              </div>

              <div
                className={`ttpe-preview-identity name-${form.nameSize}`}
              >
                <h2>{form.displayName || "Your name"}</h2>
                <span>@{form.username || "username"}</span>
                <p>{form.bio || "Your bio will appear here."}</p>
              </div>

              {form.badgeText && (
                <span className="ttpe-preview-badge">
                  {form.badgeText}
                </span>
              )}

            </div>
          </div>
        </section>

        <form
          className="ttpe-form-card ttpe-advanced-form"
          onSubmit={handleSave}
        >

          {/* IDENTITY */}

          <section className="ttpe-settings-group">

            <div className="ttpe-section-heading">
              <div>
                <h2>Identity</h2>
                <p>Your public name and account details.</p>
              </div>
            </div>

            <div className="ttpe-field">
              <label htmlFor="ttpe-display-name">
                DISPLAY NAME
              </label>

              <input
                id="ttpe-display-name"
                value={form.displayName}
                onChange={e =>
                  updateField("displayName", e.target.value)
                }
                maxLength={40}
                placeholder="Your display name"
              />
            </div>

            <div className="ttpe-field">
              <label>USERNAME</label>

              <div className="ttpe-username-input">
                <span>@</span>
                <input
                  value={form.username}
                  readOnly
                />
              </div>

              <small>
                Usernames are managed separately and cannot currently
                be changed here.
              </small>
            </div>

            <div className="ttpe-field">
              <div className="ttpe-label-row">
                <label htmlFor="ttpe-bio">ABOUT ME</label>
                <span>{form.bio.length}/160</span>
              </div>

              <textarea
                id="ttpe-bio"
                value={form.bio}
                onChange={e => updateField("bio", e.target.value)}
                maxLength={160}
                rows={3}
                placeholder="Tell people a little about yourself..."
              />
            </div>

          </section>

          {/* PROFILE ARTWORK */}

          <section className="ttpe-settings-group">

            <div className="ttpe-section-heading">
              <div>
                <h2>Profile artwork</h2>
                <p>Upload and position your profile images.</p>
              </div>
            </div>

            <div className="ttpe-field">
              <label>BANNER POSITION</label>

              <select
                value={form.bannerPosition}
                onChange={e =>
                  updateField("bannerPosition", e.target.value)
                }
              >
                <option value="center">Centre</option>
                <option value="top">Top</option>
                <option value="bottom">Bottom</option>
                <option value="left">Left</option>
                <option value="right">Right</option>
              </select>
            </div>

            <div className="ttpe-field">
              <label>
                BANNER HEIGHT · {form.bannerHeight}px
              </label>

              <input
                type="range"
                min="100"
                max="360"
                step="10"
                value={form.bannerHeight}
                onChange={e =>
                  updateField("bannerHeight", e.target.value)
                }
              />
            </div>

            <div className="ttpe-field">
              <label>AVATAR SHAPE</label>

              <div className="ttpe-choice-row">
                {[
                  ["circle", "Circle"],
                  ["rounded", "Rounded"],
                  ["square", "Square"]
                ].map(([value, label]) => (
                  <button
                    type="button"
                    key={value}
                    className={
                      form.avatarShape === value ? "selected" : ""
                    }
                    onClick={() => updateField("avatarShape", value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="ttpe-field">
              <label>AVATAR SIZE</label>

              <div className="ttpe-choice-row">
                {["small", "medium", "large"].map(value => (
                  <button
                    type="button"
                    key={value}
                    className={
                      form.avatarSize === value ? "selected" : ""
                    }
                    onClick={() => updateField("avatarSize", value)}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>

          </section>

          {/* APPEARANCE */}

          <section className="ttpe-settings-group">

            <div className="ttpe-section-heading">
              <div>
                <h2>Appearance</h2>
                <p>Fine-tune your profile's visual identity.</p>
              </div>
            </div>

            {COLOR_FIELDS.map(([field, label]) => (
              <div className="ttpe-field" key={field}>
                <label htmlFor={`ttpe-${field}`}>
                  {label.toUpperCase()}
                </label>

                <div className="ttpe-colour-picker">
                  <input
                    id={`ttpe-${field}`}
                    type="color"
                    value={form[field]}
                    onChange={e =>
                      updateField(field, e.target.value)
                    }
                  />

                  <strong>{form[field].toUpperCase()}</strong>
                </div>
              </div>
            ))}

            {[
              ["profileTheme", "PROFILE CARD STYLE", [
                ["minimal", "Minimal"],
                ["glow", "Soft glow"],
                ["outline", "Accent outline"]
              ]],
              ["profileLayout", "PROFILE LAYOUT", [
                ["standard", "Standard"],
                ["compact", "Compact"],
                ["wide", "Wide identity"]
              ]],
              ["nameSize", "DISPLAY NAME SIZE", [
                ["small", "Small"],
                ["medium", "Medium"],
                ["large", "Large"]
              ]]
            ].map(([field, label, options]) => (
              <div className="ttpe-field" key={field}>
                <label>{label}</label>

                <div className="ttpe-choice-row">
                  {options.map(([value, title]) => (
                    <button
                      type="button"
                      key={value}
                      className={
                        form[field] === value ? "selected" : ""
                      }
                      onClick={() => updateField(field, value)}
                    >
                      {title}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            <div className="ttpe-field">
              <label>TYPEFACE</label>

              <select
                value={form.fontFamily}
                onChange={e =>
                  updateField("fontFamily", e.target.value)
                }
              >
                <option value="space">Space Grotesk</option>
                <option value="dm">DM Sans</option>
                <option value="serif">Serif</option>
                <option value="mono">Monospace</option>
              </select>
            </div>

          </section>

          {/* DECORATIONS */}

          <section className="ttpe-settings-group">

            <div className="ttpe-section-heading">
              <div>
                <h2>Decorations & links</h2>
                <p>Add a little personality to your profile.</p>
              </div>
            </div>

            <div className="ttpe-field">
              <label>PROFILE DECORATION</label>

              <div className="ttpe-choice-row">
                {[
                  ["none", "None"],
                  ["ring", "Accent ring"],
                  ["spark", "Spark"],
                  ["terminal", "Terminal"]
                ].map(([value, label]) => (
                  <button
                    type="button"
                    key={value}
                    className={
                      form.decoration === value ? "selected" : ""
                    }
                    onClick={() => updateField("decoration", value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="ttpe-field">
              <label>PROFILE LABEL</label>

              <input
                value={form.badgeText}
                onChange={e =>
                  updateField("badgeText", e.target.value)
                }
                maxLength={28}
                placeholder="e.g. Founder, Trader, Builder"
              />
            </div>

            {[
              ["website", "WEBSITE", "https://example.com"],
              ["twitter", "X / TWITTER URL", "https://x.com/username"],
              ["telegram", "TELEGRAM URL", "https://t.me/username"]
            ].map(([field, label, placeholder]) => (
              <div className="ttpe-field" key={field}>
                <label>{label}</label>

                <input
                  type="url"
                  value={form[field]}
                  onChange={e =>
                    updateField(field, e.target.value)
                  }
                  placeholder={placeholder}
                />
              </div>
            ))}

          </section>

          {message && (
            <div
              className={`ttpe-message ${
                /successfully|uploaded/i.test(message)
                  ? "success"
                  : "error"
              }`}
              role="status"
              aria-live="polite"
            >
              {message}
            </div>
          )}

          <div className="ttpe-save-row">
            <div>
              <strong>Publish your profile</strong>
              <span>
                Your customisation settings will be saved to your account.
              </span>
            </div>

            <button
              type="submit"
              className="ttpe-save-button"
              disabled={saving || Boolean(uploading)}
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>

        </form>
      </main>
    </div>
  );
}