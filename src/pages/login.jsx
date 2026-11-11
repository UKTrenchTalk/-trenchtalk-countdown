import { useState } from "react";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
  updateProfile,
  deleteUser,
  signOut
} from "firebase/auth";

import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp
} from "firebase/firestore";

import { auth, db, googleProvider } from "../firebase";

// USERNAMES THAT CANNOT BE REGISTERED
const RESERVED_USERNAMES = [
  "admin", "administrator", "moderator", "support", "staff",
  "help", "security", "official", "trenchtalk", "system",
  "root", "null", "undefined", "elonmusk", "mrbeast",
  "youtube", "discord", "instagram", "tiktok", "twitter",
  "google", "facebook", "microsoft", "apple"
];

function validateUsername(value) {
  const username = value.trim().toLowerCase();

  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    return {
      valid: false,
      message: "Usernames must be 3–20 characters and use only letters, numbers and underscores."
    };
  }

  if (RESERVED_USERNAMES.includes(username)) {
    return {
      valid: false,
      message: "This username is reserved and cannot be registered."
    };
  }

  return { valid: true, username };
}

function getErrorMessage(error) {
  const errors = {
    "auth/email-already-in-use": "An account with this email already exists.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/weak-password": "Your password must be at least 6 characters.",
    "auth/user-not-found": "No account was found with that email.",
    "auth/wrong-password": "Incorrect password. Please try again.",
    "auth/invalid-credential": "Your email or password is incorrect.",
    "auth/popup-closed-by-user": "Google sign-in was cancelled.",
    "auth/popup-blocked": "Your browser blocked the Google sign-in window.",
    "auth/network-request-failed": "Network error. Check your internet connection.",
    "auth/too-many-requests": "Too many attempts. Please try again later.",
    "auth/unauthorized-domain": "This domain isn't authorised in Firebase."
  };

  return errors[error.code] || "Something went wrong. Please try again.";
}

export default function Login() {
  const [mode, setMode] = useState("login");
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleUser, setGoogleUser] = useState(null);

  const isRegister = mode === "register";
  const isGoogleRegistration = Boolean(googleUser);

  // CHECK AND RESERVE A USERNAME
  async function reserveUsername(user, rawUsername) {
    const validation = validateUsername(rawUsername);

    if (!validation.valid) {
      throw new Error(validation.message);
    }

    const username = validation.username;
    const usernameRef = doc(db, "usernames", username);
    const userRef = doc(db, "users", user.uid);

    await runTransaction(db, async (transaction) => {
      const usernameSnapshot = await transaction.get(usernameRef);
      const userSnapshot = await transaction.get(userRef);

      if (usernameSnapshot.exists()) {
        throw new Error("That username has already been taken. Please choose another.");
      }

      if (userSnapshot.exists()) {
        throw new Error("This account already has a profile.");
      }

      transaction.set(usernameRef, {
        uid: user.uid,
        username,
        createdAt: serverTimestamp()
      });

      transaction.set(userRef, {
        username,
        usernameLower: username,
        email: user.email,
        photoURL: user.photoURL || null,
        bio: "",
        role: "user",
        createdAt: serverTimestamp()
      });
    });

    await updateProfile(user, {
      displayName: username
    });

    return username;
  }

  // EMAIL REGISTRATION AND LOGIN
  async function handleSubmit(event) {
    event.preventDefault();

    setNotice("");
    setLoading(true);

    let createdUser = null;

    try {
      const form = event.currentTarget;
      const email = form.email.value.trim();
      const password = form.password.value;

      if (isRegister) {
        const validation = validateUsername(form.username.value);

        if (!validation.valid) {
          throw new Error(validation.message);
        }

        const usernameRef = doc(db, "usernames", validation.username);
        const existingUsername = await getDoc(usernameRef);

        if (existingUsername.exists()) {
          throw new Error("That username has already been taken. Please choose another.");
        }

        const result = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );

        createdUser = result.user;

        await reserveUsername(createdUser, validation.username);

        setNotice(
          `Account created successfully. Welcome to TrenchTalk, ${validation.username}.`
        );
      } else {
        const result = await signInWithEmailAndPassword(
          auth,
          email,
          password
        );

        const profileRef = doc(db, "users", result.user.uid);
        const profile = await getDoc(profileRef);

        if (!profile.exists()) {
          setNotice("Your account needs a username before you can continue. Please contact support.");
        } else {
          setNotice("Successfully signed in. Welcome back.");
        }
      }
    } catch (error) {
      if (createdUser && auth.currentUser?.uid === createdUser.uid) {
        try {
          await deleteUser(createdUser);
        } catch (cleanupError) {
          console.error("Account cleanup failed:", cleanupError);
        }
      }

      setNotice(error.message || getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  // GOOGLE SIGN-IN
  async function handleGoogleSignIn() {
    setNotice("");
    setLoading(true);

    try {
      const result = await signInWithPopup(auth, googleProvider);

      const profileRef = doc(db, "users", result.user.uid);
      const profile = await getDoc(profileRef);

      if (profile.exists()) {
        setNotice("Successfully signed in with Google. Welcome back.");
      } else {
        setGoogleUser(result.user);
        setMode("register");
        setNotice("Choose a username to finish creating your TrenchTalk account.");
      }
    } catch (error) {
      setNotice(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  // COMPLETE GOOGLE REGISTRATION
  async function handleGoogleRegistration(event) {
    event.preventDefault();

    setNotice("");
    setLoading(true);

    try {
      const username = event.currentTarget.username.value;

      await reserveUsername(googleUser, username);

      setNotice("Your TrenchTalk account has been created successfully.");
      setGoogleUser(null);
    } catch (error) {
      setNotice(error.message || getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  // CANCEL GOOGLE REGISTRATION
  async function cancelGoogleRegistration() {
    setLoading(true);

    try {
      await signOut(auth);
      setGoogleUser(null);
      setMode("login");
      setNotice("");
    } catch (error) {
      setNotice(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  // PASSWORD RESET
  async function handlePasswordReset() {
    const email = document.getElementById("email")?.value.trim();

    if (!email) {
      setNotice("Enter your email address first, then select Forgot password.");
      return;
    }

    setNotice("");
    setLoading(true);

    try {
      await sendPasswordResetEmail(auth, email);
      setNotice("Password reset email sent. Check your inbox.");
    } catch (error) {
      setNotice(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="tt-page">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Space+Grotesk:wght@400;500;600;700&display=swap');

        * {
          box-sizing: border-box;
        }

        html, body, #root {
          margin: 0;
          width: 100%;
          min-height: 100%;
        }

        body {
          overflow-x: hidden;
          overflow-y: auto;
          background: #e9eddf;
        }

        .tt-page {
          width: 100%;
          min-height: 100vh;
          min-height: 100svh;
          background: #e9eddf;
          color: #142116;
          font-family: 'DM Sans', sans-serif;
          display: flex;
          flex-direction: column;
          overflow-x: hidden;
        }

        .tt-header {
          height: 100px;
          min-height: 100px;
          flex-shrink: 0;
          padding: 0 7%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid rgba(20,33,22,.12);
        }

        .tt-brand {
          display: flex;
          align-items: center;
          gap: 13px;
        }

        .tt-brand img {
          width: 48px;
          height: 48px;
          object-fit: contain;
          display: block;
        }

        .tt-brand-name {
          font-family: 'Space Grotesk', sans-serif;
          font-size: 24px;
          font-weight: 700;
          letter-spacing: -1.3px;
          white-space: nowrap;
          color: #080d08;
        }

        .tt-brand-name span {
          color: #648d20;
        }

        .tt-header-right {
          display: flex;
          align-items: center;
          gap: 9px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: #53614e;
        }

        .tt-header-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #8dbb2e;
          flex-shrink: 0;
        }

        .tt-main {
          width: min(1240px, 86%);
          margin: auto;
          flex: 1 0 auto;
          min-height: 0;
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 390px);
          align-items: center;
          gap: 65px;
          padding: 35px 0;
        }

        .tt-left {
          min-width: 0;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .tt-overline {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 2px;
          color: #638b25;
          margin-bottom: 22px;
        }

        .tt-overline::before {
          content: "";
          width: 28px;
          height: 3px;
          background: #a8d93d;
        }

        .tt-featured {
          width: 100%;
          max-width: 510px;
          padding: 26px;
          background: #17291c;
          color: #f0f3e8;
          border: 1px solid rgba(20,33,22,.12);
          box-shadow: 11px 11px 0 #c7e69a;
        }

        .tt-featured-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 21px;
        }

        .tt-featured-label {
          color: #b5c2aa;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 1.7px;
        }

        .tt-featured-tag {
          background: #c5ff4a;
          color: #253817;
          padding: 7px 11px;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 1px;
        }

        .tt-featured-content {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .tt-featured-logo {
          width: 64px;
          height: 64px;
          background: #102015;
          border: 1px solid rgba(197,255,74,.18);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .tt-featured-logo img {
          width: 46px;
          height: 46px;
          object-fit: contain;
        }

        .tt-featured-info {
          flex: 1;
          min-width: 0;
        }

        .tt-featured-name {
          font-family: 'Space Grotesk', sans-serif;
          font-size: 18px;
          font-weight: 700;
          color: #f0f3e8;
          margin-bottom: 6px;
        }

        .tt-featured-description {
          color: #a9b49f;
          font-size: 12px;
          line-height: 1.5;
        }

        .tt-featured-arrow {
          font-size: 24px;
          color: #c5ff4a;
        }

        .tt-featured-bottom {
          margin-top: 21px;
          padding-top: 16px;
          border-top: 1px solid rgba(255,255,255,.13);
          display: flex;
          align-items: center;
          justify-content: space-between;
          color: #a9b49f;
          font-size: 12px;
        }

        .tt-featured-bottom strong {
          color: #c5ff4a;
          font-weight: 700;
        }

        .tt-login {
          width: 100%;
          max-width: 390px;
          justify-self: end;
          background: #17291c;
          color: #f0f3e8;
          padding: 22px;
          position: relative;
          box-shadow: 9px 9px 0 #c7e69a;
        }

        .tt-login::before {
          content: "";
          position: absolute;
          width: 42px;
          height: 4px;
          top: 0;
          left: 22px;
          background: #c5ff4a;
        }

        .tt-login-heading {
          margin-bottom: 14px;
        }

        .tt-login-eyebrow {
          color: #b7e85a;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 2px;
          margin-bottom: 9px;
        }

        .tt-login-heading h2 {
          font-family: 'Space Grotesk', sans-serif;
          font-size: 28px;
          font-weight: 600;
          letter-spacing: -1.4px;
          margin: 0 0 6px;
        }

        .tt-login-heading p {
          margin: 0;
          color: #9ca995;
          font-size: 12px;
          line-height: 1.5;
        }

        .tt-form {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .tt-field {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .tt-field label {
          font-size: 10px;
          font-weight: 800;
          letter-spacing: .7px;
          color: #d4ddc9;
        }

        .tt-field input {
          width: 100%;
          height: 40px;
          padding: 0 12px;
          border: 1px solid rgba(255,255,255,.16);
          background: #102015;
          color: #f1f3ed;
          font-family: 'DM Sans', sans-serif;
          font-size: 13px;
          outline: none;
          border-radius: 0;
          transition: border-color .2s;
        }

        .tt-field input::placeholder {
          color: #73816e;
        }

        .tt-field input:focus {
          border-color: #c5ff4a;
        }

        .tt-password {
          position: relative;
        }

        .tt-password input {
          padding-right: 65px;
        }

        .tt-password button {
          position: absolute;
          top: 50%;
          right: 13px;
          transform: translateY(-50%);
          background: none;
          border: 0;
          color: #b7e85a;
          font-family: 'DM Sans', sans-serif;
          font-size: 10px;
          font-weight: 700;
          cursor: pointer;
        }

        .tt-options {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }

        .tt-remember {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #a9b49f;
          font-size: 11px;
          cursor: pointer;
        }

        .tt-remember input {
          width: 14px;
          height: 14px;
          margin: 0;
          accent-color: #c5ff4a;
        }

        .tt-forgot {
          border: 0;
          background: none;
          padding: 0;
          color: #c5ff4a;
          font-family: 'DM Sans', sans-serif;
          font-size: 11px;
          cursor: pointer;
        }

        .tt-submit {
          width: 100%;
          height: 42px;
          margin-top: 2px;
          border: 0;
          background: #c5ff4a;
          color: #17291c;
          font-family: 'Space Grotesk', sans-serif;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: .7px;
          cursor: pointer;
          transition: .2s;
        }

        .tt-submit:hover:not(:disabled) {
          background: #dcff89;
          transform: translateY(-2px);
        }

        .tt-submit:disabled,
        .tt-google:disabled {
          opacity: .65;
          cursor: wait;
        }

        .tt-divider {
          display: flex;
          align-items: center;
          gap: 12px;
          color: #879783;
          font-size: 10px;
          letter-spacing: 1px;
          margin: 1px 0;
        }

        .tt-divider::before,
        .tt-divider::after {
          content: "";
          flex: 1;
          height: 1px;
          background: rgba(255,255,255,.13);
        }

        .tt-google {
          width: 100%;
          height: 39px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          border: 1px solid rgba(255,255,255,.2);
          background: transparent;
          color: #f0f3e8;
          font-family: 'DM Sans', sans-serif;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: .2s;
        }

        .tt-google:hover:not(:disabled) {
          border-color: #c5ff4a;
          background: rgba(197,255,74,.06);
        }

        .tt-notice {
          padding: 9px;
          background: rgba(197,255,74,.08);
          border: 1px solid rgba(197,255,74,.2);
          color: #d2edaa;
          font-size: 11px;
          line-height: 1.5;
          overflow-wrap: anywhere;
        }

        .tt-switch {
          border-top: 1px solid rgba(255,255,255,.12);
          margin-top: 13px;
          padding-top: 12px;
          color: #9ca995;
          font-size: 11px;
          text-align: center;
        }

        .tt-switch button {
          background: none;
          border: 0;
          color: #c5ff4a;
          font-family: 'DM Sans', sans-serif;
          font-size: 11px;
          font-weight: 800;
          margin-left: 5px;
          cursor: pointer;
        }

        /* COMPACT REGISTRATION */

        .tt-login.register-mode {
          padding: 17px 21px;
        }

        .tt-login.register-mode::before {
          left: 21px;
        }

        .tt-login.register-mode .tt-login-heading {
          margin-bottom: 9px;
        }

        .tt-login.register-mode .tt-login-heading h2 {
          font-size: 26px;
          margin-bottom: 5px;
        }

        .tt-login.register-mode .tt-login-heading p {
          font-size: 11px;
        }

        .tt-login.register-mode .tt-form {
          gap: 7px;
        }

        .tt-login.register-mode .tt-field {
          gap: 4px;
        }

        .tt-login.register-mode .tt-field input {
          height: 36px;
        }

        .tt-login.register-mode .tt-submit {
          height: 38px;
          margin-top: 1px;
        }

        .tt-login.register-mode .tt-divider {
          margin: 0;
        }

        .tt-login.register-mode .tt-google {
          height: 35px;
        }

        .tt-login.register-mode .tt-switch {
          margin-top: 9px;
          padding-top: 9px;
        }

        .tt-footer {
          min-height: 48px;
          flex-shrink: 0;
          padding: 0 7%;
          border-top: 1px solid rgba(20,33,22,.12);
          display: flex;
          align-items: center;
          justify-content: flex-start;
          color: #75806e;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: .8px;
        }

        @media (max-width: 1000px) and (min-width: 761px) {
          .tt-main {
            gap: 35px;
            grid-template-columns: minmax(0, 1fr) minmax(0, 370px);
          }

          .tt-login {
            padding: 19px;
          }

          .tt-login::before {
            left: 19px;
          }

          .tt-featured {
            padding: 22px;
          }
        }

        @media (max-width: 760px) {
          .tt-header {
            height: 82px;
            min-height: 82px;
            padding: 0 20px;
          }

          .tt-main {
            width: min(500px, 88%);
            grid-template-columns: 1fr;
            gap: 42px;
            padding: 40px 0 48px;
          }

          .tt-left {
            padding-top: 5px;
          }

          .tt-featured {
            max-width: 100%;
          }

          .tt-login {
            max-width: 100%;
            box-shadow: 9px 9px 0 #c7e69a;
          }
        }

        @media (max-width: 520px) {
          .tt-brand img {
            width: 43px;
            height: 43px;
          }

          .tt-brand-name {
            font-size: 20px;
          }

          .tt-header-right {
            font-size: 9px;
            letter-spacing: .4px;
          }

          .tt-main {
            width: calc(100% - 40px);
            padding: 32px 0 42px;
            gap: 35px;
          }

          .tt-featured {
            padding: 21px;
          }

          .tt-featured-name {
            font-size: 16px;
          }

          .tt-login {
            padding: 22px 19px;
            box-shadow: 7px 7px 0 #c7e69a;
          }

          .tt-login::before {
            left: 19px;
          }

          .tt-login-heading h2 {
            font-size: 26px;
          }

          .tt-login.register-mode {
            padding: 17px 19px;
          }

          .tt-login.register-mode::before {
            left: 19px;
          }

          .tt-footer {
            padding: 15px 20px;
          }
        }

        @media (max-height: 820px) and (min-width: 761px) {
          .tt-main {
            padding-top: 20px;
            padding-bottom: 20px;
            gap: 45px;
          }

          .tt-login {
            padding: 18px;
          }

          .tt-login::before {
            left: 18px;
          }

          .tt-login-heading {
            margin-bottom: 11px;
          }

          .tt-login-heading h2 {
            font-size: 26px;
          }

          .tt-form {
            gap: 8px;
          }

          .tt-field input {
            height: 37px;
          }

          .tt-submit {
            height: 39px;
          }

          .tt-google {
            height: 36px;
          }

          .tt-switch {
            margin-top: 10px;
            padding-top: 9px;
          }

          .tt-featured {
            padding: 23px;
          }

          .tt-featured-top {
            margin-bottom: 17px;
          }

          .tt-featured-bottom {
            margin-top: 18px;
            padding-top: 14px;
          }
        }
      `}</style>

      <header className="tt-header">
        <div className="tt-brand">
          <img src="/logo2.png" alt="TrenchTalk" />

          <div className="tt-brand-name">
            TRENCH<span>TALK</span>
          </div>
        </div>

        <div className="tt-header-right">
          <span className="tt-header-dot" />
          BETA TESTING
        </div>
      </header>

      <main className="tt-main">
        <section className="tt-left">
          <div className="tt-overline">COMMUNITY SPOTLIGHT</div>

          <div className="tt-featured">
            <div className="tt-featured-top">
              <span className="tt-featured-label">
                FEATURED COMMUNITY
              </span>

              <span className="tt-featured-tag">OFFICIAL</span>
            </div>

            <div className="tt-featured-content">
              <div className="tt-featured-logo">
                <img src="/logo2.png" alt="TrenchTalk" />
              </div>

              <div className="tt-featured-info">
                <div className="tt-featured-name">
                  TrenchTalk Official
                </div>

                <div className="tt-featured-description">
                  The official home of the TrenchTalk community.
                </div>
              </div>

              <div className="tt-featured-arrow">↗</div>
            </div>

            <div className="tt-featured-bottom">
              <span>Discover the community</span>
              <strong>EXPLORE →</strong>
            </div>
          </div>
        </section>

        <section className={`tt-login ${isRegister ? "register-mode" : ""}`}>
          <div className="tt-login-heading">
            <div className="tt-login-eyebrow">
              {isGoogleRegistration
                ? "COMPLETE YOUR REGISTRATION"
                : isRegister
                  ? "CREATE YOUR ACCOUNT"
                  : "MEMBER ACCESS"}
            </div>

            <h2>
              {isGoogleRegistration
                ? "Choose a username"
                : isRegister
                  ? "Join TrenchTalk"
                  : "Welcome back"}
            </h2>

            <p>
              {isGoogleRegistration
                ? "Your Google account is connected. Choose your unique username."
                : isRegister
                  ? "Create an account and find your community."
                  : "Sign in to pick up where you left off."}
            </p>
          </div>

          {isGoogleRegistration ? (
            <form className="tt-form" onSubmit={handleGoogleRegistration}>
              <div className="tt-field">
                <label htmlFor="username">USERNAME</label>

                <input
                  id="username"
                  name="username"
                  type="text"
                  placeholder="Choose a username"
                  minLength={3}
                  maxLength={20}
                  autoComplete="username"
                  required
                />
              </div>

              <button
                type="submit"
                className="tt-submit"
                disabled={loading}
              >
                {loading ? "PLEASE WAIT..." : "COMPLETE REGISTRATION"}
              </button>

              <button
                type="button"
                className="tt-google"
                onClick={cancelGoogleRegistration}
                disabled={loading}
              >
                Cancel
              </button>

              {notice && (
                <div className="tt-notice" role="status">
                  {notice}
                </div>
              )}
            </form>
          ) : (
            <form className="tt-form" onSubmit={handleSubmit}>
              {isRegister && (
                <div className="tt-field">
                  <label htmlFor="username">USERNAME</label>

                  <input
                    id="username"
                    name="username"
                    type="text"
                    placeholder="Choose a username"
                    autoComplete="username"
                    minLength={3}
                    maxLength={20}
                    required
                  />
                </div>
              )}

              <div className="tt-field">
                <label htmlFor="email">EMAIL ADDRESS</label>

                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </div>

              <div className="tt-field">
                <label htmlFor="password">PASSWORD</label>

                <div className="tt-password">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    autoComplete={isRegister ? "new-password" : "current-password"}
                    minLength={6}
                    required
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? "HIDE" : "SHOW"}
                  </button>
                </div>
              </div>

              {!isRegister && (
                <div className="tt-options">
                  <label className="tt-remember">
                    <input type="checkbox" />
                    Remember me
                  </label>

                  <button
                    type="button"
                    className="tt-forgot"
                    onClick={handlePasswordReset}
                    disabled={loading}
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              <button
                type="submit"
                className="tt-submit"
                disabled={loading}
              >
                {loading
                  ? "PLEASE WAIT..."
                  : isRegister
                    ? "CREATE ACCOUNT"
                    : "SIGN IN"}
              </button>

              <div className="tt-divider">OR</div>

              <button
                type="button"
                className="tt-google"
                onClick={handleGoogleSignIn}
                disabled={loading}
              >
                <svg viewBox="0 0 48 48" width="17" height="17" aria-hidden="true">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.76 7.18l7.73 6C44.42 37.96 46.98 31.92 46.98 24.55z" />
                  <path fill="#FBBC05" d="M10.53 28.59a14.4 14.4 0 0 1-.76-4.59c0-1.59.27-3.13.76-4.59l-7.98-6.19A23.9 23.9 0 0 0 0 24c0 3.86.92 7.51 2.56 10.78l7.97-6.19z" />
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.15 1.45-4.9 2.3-8.18 2.3-6.26 0-11.57-4.22-13.46-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                </svg>

                Continue with Google
              </button>

              {notice && (
                <div className="tt-notice" role="status">
                  {notice}
                </div>
              )}
            </form>
          )}

          {!isGoogleRegistration && (
            <div className="tt-switch">
              {isRegister
                ? "Already have an account?"
                : "New to TrenchTalk?"}

              <button
                type="button"
                onClick={() => {
                  setMode(isRegister ? "login" : "register");
                  setNotice("");
                  setShowPassword(false);
                }}
              >
                {isRegister ? "Sign in" : "Create account"}
              </button>
            </div>
          )}
        </section>
      </main>

      <footer className="tt-footer">
        <span>© {new Date().getFullYear()} TRENCHTALK</span>
      </footer>
    </div>
  );
}