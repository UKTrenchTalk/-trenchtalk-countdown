import { useEffect, useState } from "react";
import "./Countdown.css";

const ADMIN_PASSCODE = "LOWKAXBI";

export default function Countdown({ onLogin }) {
  const launchDate = new Date("2026-12-20T12:00:00Z").getTime();

  const [time, setTime] = useState({
    days: "00",
    hours: "00",
    minutes: "00",
    seconds: "00",
  });

  const [isLive, setIsLive] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [screen, setScreen] = useState("countdown");
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");

  const [theme, setTheme] = useState(
    () => localStorage.getItem("tt-countdown-theme") || "dark"
  );

  useEffect(() => {
    function updateCountdown() {
      const difference = launchDate - Date.now();

      if (difference <= 0) {
        setIsLive(true);
        return;
      }

      setTime({
        days: String(Math.floor(difference / 86400000)).padStart(2, "0"),
        hours: String(Math.floor(difference / 3600000) % 24).padStart(2, "0"),
        minutes: String(Math.floor(difference / 60000) % 60).padStart(2, "0"),
        seconds: String(Math.floor(difference / 1000) % 60).padStart(2, "0"),
      });
    }

    updateCountdown();

    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    localStorage.setItem("tt-countdown-theme", theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((current) => current === "dark" ? "light" : "dark");
  }

  function openScreen(newScreen) {
    setScreen(newScreen);
    setMenuOpen(false);
    setError("");
    setPasscode("");
  }

  function checkPasscode(event) {
    event.preventDefault();

    if (passcode === ADMIN_PASSCODE) {
      sessionStorage.setItem("tt-admin-unlocked", "true");
      onLogin();
    } else {
      setError("Incorrect passcode. Please try again.");
      setPasscode("");
    }
  }

  return (
    <div className={`countdown-page ${theme === "light" ? "light-theme" : ""}`}>

      <header className="countdown-header">
        <img
          src="/Assets/logo.png"
          className="countdown-logo"
          alt="TrenchTalk"
        />
      </header>

      <div className="countdown-controls">

        <button
          className="theme-toggle"
          onClick={toggleTheme}
          aria-label="Toggle colour theme"
        >
          {theme === "dark" ? "☀ LIGHT MODE" : "☾ DARK MODE"}
        </button>

        <div className="countdown-menu-wrapper">
          <button
            className="menu-dots"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Open menu"
          >
            ···
          </button>

          {menuOpen && (
            <div className="countdown-dropdown">
              <button onClick={() => openScreen("beta")}>
                Beta Testing
              </button>

              <button onClick={() => openScreen("admin")}>
                Admin
              </button>
            </div>
          )}
        </div>

      </div>

      {screen === "countdown" && (
        <main className="countdown-container">

          {isLive ? (
            <div className="countdown-live">
              TRENCHTALK IS LIVE
            </div>
          ) : (
            <div className="countdown">

              {Object.entries(time).map(([label, value], index) => (
                <div className="countdown-group" key={label}>

                  <div className="time-unit">
                    <span>{value}</span>
                    <small>{label}</small>
                  </div>

                  {index !== 3 && (
                    <div className="separator">:</div>
                  )}

                </div>
              ))}

            </div>
          )}

        </main>
      )}

      {screen !== "countdown" && (
        <main className="countdown-screen">

          <button
            className="screen-back"
            onClick={() => openScreen("countdown")}
          >
            ← BACK
          </button>

          {screen === "beta" && (
            <div className="countdown-card">

              <div className="screen-eyebrow">
                TRENCHTALK COMMUNITY
              </div>

              <h1>Become a beta tester.</h1>

              <p>
                Want to get involved before the official launch?
                We're looking for people interested in testing
                TrenchTalk and helping shape the platform.
              </p>

              <a
                className="beta-email-button"
                href="mailto:trenchtalker@gmail.com?subject=TrenchTalk%20Beta%20Testing"
              >
                APPLY FOR BETA ACCESS ↗
              </a>

              <span className="beta-email">
                trenchtalker@gmail.com
              </span>

            </div>
          )}

          {screen === "admin" && (
            <form className="countdown-card" onSubmit={checkPasscode}>

              <div className="screen-eyebrow">
                RESTRICTED ACCESS
              </div>

              <h1>Administrator.</h1>

              <p>
                Enter your administrator passcode to continue.
              </p>

              <input
                className="admin-passcode"
                type="password"
                placeholder="Enter passcode"
                value={passcode}
                onChange={(event) => setPasscode(event.target.value)}
                autoComplete="off"
                autoFocus
              />

              {error && (
                <div className="passcode-error">
                  {error}
                </div>
              )}

              <button
                className="admin-submit"
                type="submit"
                disabled={!passcode.trim()}
              >
                UNLOCK ACCESS ↗
              </button>

            </form>
          )}

        </main>
      )}

    </div>
  );
}