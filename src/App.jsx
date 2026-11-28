import { useEffect, useMemo, useRef, useState } from "react";

import { onAuthStateChanged, signOut, signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from "firebase/auth";

import { collection, doc, getDoc, getDocs, limit, query, setDoc, deleteDoc, serverTimestamp, writeBatch, onSnapshot } from "firebase/firestore";

import { auth, db, googleProvider } from "./firebase.js";

import Countdown from "./countdown.jsx";

import Login from "./pages/login.jsx";

import trendingService from "./Services/trendingservice.js";

import tokenService from "./Services/tokenservice.js";

import { enrichTokens } from "./Services/marketDataService.js";

import "./App.css";

import ProfileEditor from "./components/ProfileEditor.jsx";
import ProfilePage from "./components/ProfilePage.jsx";
import homeIcon from "./assets/Home.png";
import notificationsIcon from "./assets/notifications.png";
import messagesIcon from "./assets/messages.png";
import communitiesIcon from "./assets/communities.png";



const NEW_TOKEN_DELAY = 10 * 60 * 1000;

const TOKEN_REFRESH_INTERVAL = 15000;

const IMAGE_REFRESH_INTERVAL = 30 * 1000;



const navigation = [

  { id: "home", icon: homeIcon, label: "Home", image: true },


  { id: "explore", icon: "⌕", label: "Explore" },

  { id: "notifications", icon: notificationsIcon, label: "Notifications", image: true },

  { id: "messages", icon: messagesIcon, label: "Messages", image: true },

  { id: "communities", icon: communitiesIcon, label: "Communities", image: true },

  { id: "bookmarks", icon: "☆", label: "Saved" },

];



function Avatar({ letter, large = false, imageUrl }) {

  return (

    <div className={`tt-avatar ${large ? "large" : ""}`}>

      {imageUrl ? (

        <img src={imageUrl} alt="Profile" />

      ) : (

        letter || "T"

      )}

    </div>

  );

}



function formatMoney(value) {

  const number = Number(value);



  if (!Number.isFinite(number)) return "—";

  if (number >= 1_000_000_000) return `$${(number / 1_000_000_000).toFixed(2)}B`;

  if (number >= 1_000_000) return `$${(number / 1_000_000).toFixed(2)}M`;

  if (number >= 1_000) return `$${(number / 1_000).toFixed(2)}K`;



  return `$${number.toFixed(2)}`;

}



function formatPrice(value) {

  const number = Number(value);



  if (!Number.isFinite(number) || number <= 0) return "—";

  if (number < 0.000001) return `$${number.toExponential(2)}`;

  if (number < 0.01) return `$${number.toFixed(8)}`;

  if (number < 1) return `$${number.toFixed(6)}`;



  return `$${number.toFixed(2)}`;

}



function formatChange(value) {

  const number = Number(value);



  if (!Number.isFinite(number)) return null;



  return `${number >= 0 ? "+" : ""}${number.toFixed(2)}%`;

}



function toBrowserImageUri(uri) {

  if (!uri || typeof uri !== "string") return null;



  const value = uri.trim();



  if (value.startsWith("ipfs://")) {

    return `https://ipfs.io/ipfs/${value.slice(7)}`;

  }



  if (value.startsWith("ar://")) {

    return `https://arweave.net/${value.slice(5)}`;

  }



  if (value.startsWith("https://") || value.startsWith("http://")) {

    return value;

  }



  return null;

}



async function fetchTokenImage(token) {

  if (token.uri) {

    const metadataUrl = toBrowserImageUri(token.uri);



    if (metadataUrl) {

      try {

        const controller = new AbortController();

        const timeout = setTimeout(() => controller.abort(), 5000);



        try {

          const response = await fetch(metadataUrl, {

            signal: controller.signal

          });



          if (response.ok) {

            const metadata = await response.json();

            const image = toBrowserImageUri(

              metadata.image ||

              metadata.image_url ||

              metadata.logoURI ||

              metadata.logo ||

              metadata.properties?.files?.[0]?.uri

            );



            if (image) return image;

          }

        } finally {

          clearTimeout(timeout);

        }

      } catch (error) {

        console.warn("[Token images] Metadata lookup failed:", error.message);

      }

    }

  }



  if (token.mint) {

    try {

      const controller = new AbortController();

      const timeout = setTimeout(() => controller.abort(), 5000);



      try {

        const response = await fetch(

          `https://api.jup.ag/tokens/v2/search?query=${encodeURIComponent(token.mint)}`,

          { signal: controller.signal }

        );



        if (response.ok) {

          const results = await response.json();

          const match = Array.isArray(results)

            ? results.find((item) => item.id === token.mint)

            : null;



          const image = toBrowserImageUri(match?.icon);

          if (image) return image;

        }

      } finally {

        clearTimeout(timeout);

      }

    } catch (error) {

      console.warn("[Token images] Jupiter lookup failed:", error.message);

    }

  }



  return null;

}



function TokenCard({ token, index, onImageError }) {

  const market = token.market || {};

  const image = token.imageUrl || market.imageUrl;

  const priceChange = formatChange(market.priceChange24h);



  return (

    <article className="tt-token-card">

      <div className="tt-token-card-top">

        <div className="tt-token-identity">

          {image ? (

            <img

              className="tt-token-image"

              src={image}

              alt={token.name || token.symbol || "Token"}

              loading="lazy"

              onError={(event) => {

                event.currentTarget.style.display = "none";

                onImageError?.(token.mint);



                const placeholder =

                  event.currentTarget.parentElement.querySelector(

                    ".tt-token-placeholder"

                  );



                if (placeholder) {

                  placeholder.style.display = "flex";

                }

              }}

            />

          ) : null}



          <div

            className="tt-token-placeholder"

            style={{ display: image ? "none" : "flex" }}

          >

            <svg

              className="tt-token-placeholder-icon"

              viewBox="0 0 40 40"

              role="img"

              aria-label="Token image unavailable"

            >

              <path

                d="M20 3.5 35 12v16L20 36.5 5 28V12L20 3.5Z"

                fill="none"

                stroke="currentColor"

                strokeWidth="2.2"

                strokeLinejoin="round"

              />

              <path

                d="m13 15 7-4 7 4v10l-7 4-7-4V15Z"

                fill="currentColor"

                opacity=".18"

              />

              <path

                d="m13 15 7 4 7-4M20 19v10"

                fill="none"

                stroke="currentColor"

                strokeWidth="2"

                strokeLinejoin="round"

              />

            </svg>

          </div>



          <div className="tt-token-name">

            <strong>{token.name || "Unknown Token"}</strong>

            <span>${token.symbol || "UNKNOWN"}</span>

          </div>

        </div>



        <span className="tt-token-rank">#{index + 1}</span>

      </div>



      {/* MAIN MARKET CAP */}

      <div className="tt-token-price">

       {market.marketCap != null

  ? `${formatMoney(market.marketCap)} MC`

  : "Market cap unavailable"}

      </div>



      {/* TOKEN STATISTICS */}

      <div className="tt-token-stats">

        <div>

          <span>Token price</span>

          <strong>{formatPrice(market.priceUsd)}</strong>

        </div>



        <div>

          <span>24h volume</span>

          <strong>{formatMoney(market.volume24h)}</strong>

        </div>



        <div>

          <span>Liquidity</span>

          <strong>{formatMoney(market.liquidity)}</strong>

        </div>



        <div>

          <span>24h change</span>

          <strong

            className={

              priceChange === null

                ? ""

                : Number(market.priceChange24h) >= 0

                  ? "positive"

                  : "negative"

            }

          >

            {priceChange || "—"}

          </strong>

        </div>

      </div>



      <div className="tt-token-card-footer">

        <span className="tt-token-protocol">

          {token.protocol || "Solana"}

        </span>



        {market.pairUrl ? (

          <a

            href={market.pairUrl}

            target="_blank"

            rel="noopener noreferrer"

            className="tt-token-view"

          >

            View token ↗

          </a>

        ) : (

          <span className="tt-token-unavailable">

            Market unavailable

          </span>

        )}

      </div>

    </article>

  );

}



function EmptyState({ icon, title, description }) {

  return (

    <div className="tt-empty-feed">

      <div className="tt-empty-symbol">{icon}</div>

      <h2>{title}</h2>

      <p>{description}</p>

    </div>

  );

}



function App() {

  const [user, setUser] = useState(null);

  const [profile, setProfile] = useState(null);

  const [authLoading, setAuthLoading] = useState(true);

const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const createMenuRef = useRef(null);

  const [showLogin, setShowLogin] = useState(false);



  const [activePage, setActivePage] = useState("home");

  const [postText, setPostText] = useState("");

  const [search, setSearch] = useState("");




  const [exploreTab, setExploreTab] = useState("trending");
  const [exploreResults, setExploreResults] = useState([]);
  const [exploreSourceRows, setExploreSourceRows] = useState([]);
  const exploreCacheRef = useRef(new Map());
  const [exploreLoading, setExploreLoading] = useState(false);
  const [exploreError, setExploreError] = useState("");
  const [viewingPublicProfile, setViewingPublicProfile] = useState(null);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [savedAccounts, setSavedAccounts] = useState(() => {
    try {
      const raw = JSON.parse(localStorage.getItem("tt-saved-accounts") || "[]");
      const unique = new Map();
      for (const item of (Array.isArray(raw) ? raw : [])) {
        if (item?.uid && !unique.has(item.uid)) unique.set(item.uid, item);
      }
      return [...unique.values()];
    } catch { return []; }
  });
  const [accountEmail, setAccountEmail] = useState("");
  const [accountPassword, setAccountPassword] = useState("");
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountError, setAccountError] = useState("");
  const [socialState, setSocialState] = useState({ following: false, friendStatus: "none", busy: false, error: "" });
  const [friendRequests, setFriendRequests] = useState([]);
  const [messageContacts, setMessageContacts] = useState([]);


  const [trendingTokens, setTrendingTokens] = useState([]);

  const [newTokens, setNewTokens] = useState([]);

  const [enrichedNewTokens, setEnrichedNewTokens] = useState([]);

  const [searchResults, setSearchResults] = useState([]);

  const [searchLoading, setSearchLoading] = useState(false);

  const [tokenConnected, setTokenConnected] = useState(false);

  const [clock, setClock] = useState(Date.now());

  const [failedImageMints, setFailedImageMints] = useState(() => new Set());



  const imageSourcesRef = useRef({

    newTokens: [],

    trendingTokens: [],

    searchResults: []

  });



  const failedImageMintsRef = useRef(failedImageMints);



  imageSourcesRef.current = {

    newTokens,

    trendingTokens,

    searchResults

  };



  failedImageMintsRef.current = failedImageMints;



  // Close the Create menu when the user clicks elsewhere or presses Escape.
  useEffect(() => {
    if (!createMenuOpen) return undefined;
    const handlePointerDown = (event) => {
      if (createMenuRef.current && !createMenuRef.current.contains(event.target)) setCreateMenuOpen(false);
    };
    const handleKeyDown = (event) => { if (event.key === "Escape") setCreateMenuOpen(false); };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [createMenuOpen]);

  useEffect(() => {
    const open = () => openAccountManager();
    window.addEventListener("tt-open-add-account", open);
    return () => window.removeEventListener("tt-open-add-account", open);
  }, []);

  // Account manager actions are passed directly to profile sidebars.
  function openAccountManager(selectedAccount = null) {
    setAccountError("");
    setAccountPassword("");
    setAccountEmail(selectedAccount?.email || "");
    setAccountModalOpen(true);
  }

  function selectRememberedAccount(item) {
    if (!item || item.uid === user?.uid) return;
    // Firebase uses one active Auth user per app. Re-authentication is required;
    // never store passwords or refresh tokens in localStorage.
    openAccountManager(item);
    setAccountError(`Sign in as ${item.email} to switch to this account.`);
  }

  function rememberAccount(accountUser) {
    if (!accountUser?.uid || !accountUser?.email) return;
    setSavedAccounts((previous) => {
      const next = [{
        ...(previous.find((item) => item.uid === accountUser.uid) || {}),
        uid: accountUser.uid,
        email: accountUser.email,
        displayName: accountUser.displayName || accountUser.email.split("@")[0],
        avatarUrl: accountUser.photoURL || previous.find((item) => item.uid === accountUser.uid)?.avatarUrl || ""
      }, ...previous.filter((item) => item.uid !== accountUser.uid)].slice(0, 8);
      try { localStorage.setItem("tt-saved-accounts", JSON.stringify(next)); } catch (error) { console.warn("Could not save account list:", error); }
      return next;
    });
  }

  async function authenticateAnotherAccount(method = "password") {
    setAccountError("");
    setAccountBusy(true);
    try {
      if (user) rememberAccount(user);
      let credential;
      if (method === "google") {
        googleProvider.setCustomParameters({ prompt: "select_account" });
        credential = await signInWithPopup(auth, googleProvider);
      } else {
        if (!accountEmail.trim() || !accountPassword) {
          setAccountError("Enter the account email and password.");
          return;
        }
        credential = await signInWithEmailAndPassword(auth, accountEmail.trim(), accountPassword);
      }
      if (credential.user.uid === user?.uid) {
        setAccountError("That is already the active account.");
        return;
      }
      rememberAccount(credential.user);
      setAccountPassword("");
      setAccountModalOpen(false);
      setActivePage("home");
      setViewingPublicProfile(null);
    } catch (error) {
      const messages = {
        "auth/invalid-credential": "The email or password is incorrect.",
        "auth/user-not-found": "No account was found with that email.",
        "auth/wrong-password": "The password is incorrect.",
        "auth/too-many-requests": "Too many attempts. Try again later.",
        "auth/popup-closed-by-user": "Google sign-in was cancelled.",
        "auth/popup-blocked": "Your browser blocked the Google sign-in window.",
        "auth/network-request-failed": "Network error. Check your connection."
      };
      setAccountError(messages[error.code] || error.message || "Could not sign in to that account.");
    } finally {
      setAccountBusy(false);
    }
  }

  useEffect(() => {
    const removeSaved = (event) => {
      const uid = event.detail;
      if (!uid || uid === user?.uid) return;
      setSavedAccounts((previous) => {
        const next = previous.filter((item) => item.uid !== uid);
        try { localStorage.setItem("tt-saved-accounts", JSON.stringify(next)); } catch {}
        return next;
      });
    };
    window.addEventListener("tt-remove-saved-account", removeSaved);
    return () => window.removeEventListener("tt-remove-saved-account", removeSaved);
  }, [user?.uid]);


  // Social graph: follows are immediate; friendships require recipient acceptance.
  async function refreshSocialState(target) {
    if (!user?.uid || !target?.uid || target.uid === user.uid) return;
    try {
      const [followingSnap, outgoingSnap, incomingSnap, friendsSnap] = await Promise.all([
        getDoc(doc(db, "users", user.uid, "following", target.uid)),
        getDoc(doc(db, "users", user.uid, "friendRequestsSent", target.uid)),
        getDoc(doc(db, "users", user.uid, "friendRequestsReceived", target.uid)),
        getDoc(doc(db, "users", user.uid, "friends", target.uid))
      ]);
      setSocialState({
        following: followingSnap.exists(),
        friendStatus: friendsSnap.exists() ? "friends" : outgoingSnap.exists() ? "sent" : incomingSnap.exists() ? "received" : "none",
        busy: false, error: ""
      });
    } catch (error) {
      console.error("Social state load failed:", error);
      setSocialState(current => ({ ...current, error: "Could not load relationship status." }));
    }
  }

  useEffect(() => {
    if (activePage === "public-profile" && viewingPublicProfile?.uid) refreshSocialState(viewingPublicProfile);
  }, [activePage, viewingPublicProfile?.uid, user?.uid]);

  async function handleFollow(target, shouldFollow) {
    if (!user?.uid || !target?.uid || target.uid === user.uid) return;
    setSocialState(current => ({ ...current, busy: true, error: "" }));
    const me = user.uid, them = target.uid;
    const batch = writeBatch(db);
    const followingRef = doc(db, "users", me, "following", them);
    const followerRef = doc(db, "users", them, "followers", me);
    if (shouldFollow) {
      const data = { uid: them, displayName: target.displayName || target.username || "Member", username: target.username || "", avatarUrl: target.avatarUrl || "", createdAt: serverTimestamp() };
      batch.set(followingRef, data);
      batch.set(followerRef, { uid: me, displayName: profile?.displayName || user.displayName || user.email?.split("@")[0], username: profile?.username || "", avatarUrl: profile?.avatarUrl || "", createdAt: serverTimestamp() });
    } else {
      batch.delete(followingRef); batch.delete(followerRef);
    }
    try { await batch.commit(); await refreshSocialState(target); }
    catch (error) { console.error("Follow update failed:", error); setSocialState(current => ({ ...current, busy: false, error: error.message || "Follow update failed." })); }
  }

  async function handleFriendRequest(target) {
    if (!user?.uid || !target?.uid || target.uid === user.uid) return;
    setSocialState(current => ({ ...current, busy: true, error: "" }));
    const me = user.uid, them = target.uid;
    const outgoing = doc(db, "users", me, "friendRequestsSent", them);
    const incoming = doc(db, "users", them, "friendRequestsReceived", me);
    const payload = { fromUid: me, toUid: them, fromName: profile?.displayName || user.displayName || user.email?.split("@")[0] || "Member", fromUsername: profile?.username || "", fromAvatarUrl: profile?.avatarUrl || "", toName: target.displayName || target.username || "Member", createdAt: serverTimestamp() };
    try {
      await Promise.all([setDoc(outgoing, payload), setDoc(incoming, payload)]);
      await refreshSocialState(target);
    } catch (error) { console.error("Friend request failed:", error); setSocialState(current => ({ ...current, busy: false, error: error.message || "Could not send request." })); }
  }

  async function handleFriendRequestDecision(request, accept) {
    if (!user?.uid || !request?.fromUid) return;
    const other = request.fromUid;
    const batch = writeBatch(db);
    batch.delete(doc(db, "users", user.uid, "friendRequestsReceived", other));
    batch.delete(doc(db, "users", other, "friendRequestsSent", user.uid));
    if (accept) {
      const mine = { uid: other, displayName: request.fromName || "Member", username: request.fromUsername || "", avatarUrl: request.fromAvatarUrl || "", createdAt: serverTimestamp() };
      const theirs = { uid: user.uid, displayName: profile?.displayName || user.displayName || "Member", username: profile?.username || "", avatarUrl: profile?.avatarUrl || "", createdAt: serverTimestamp() };
      batch.set(doc(db, "users", user.uid, "friends", other), mine);
      batch.set(doc(db, "users", other, "friends", user.uid), theirs);

      // Discord-style DM list entry: accepting a request creates a conversation
      // contact for both users immediately, even before either sends a message.
      const conversationId = [user.uid, other].sort().join("_");
      batch.set(doc(db, "users", user.uid, "conversations", other), {
        uid: other,
        displayName: request.fromName || "Member",
        username: request.fromUsername || "",
        avatarUrl: request.fromAvatarUrl || "",
        conversationId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastMessage: ""
      });
      batch.set(doc(db, "users", other, "conversations", user.uid), {
        uid: user.uid,
        displayName: profile?.displayName || user.displayName || "Member",
        username: profile?.username || "",
        avatarUrl: profile?.avatarUrl || "",
        conversationId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastMessage: ""
      });
    }
    try { await batch.commit(); setFriendRequests(current => current.filter(item => item.uid !== other)); }
    catch (error) { console.error("Friend request decision failed:", error); }
  }

  useEffect(() => {
    if (!user?.uid) { setFriendRequests([]); return; }
    const requestsRef = collection(db, "users", user.uid, "friendRequestsReceived");
    const unsubscribe = onSnapshot(requestsRef,
      snapshot => setFriendRequests(snapshot.docs.map(item => ({ uid: item.id, ...item.data() }))),
      error => console.error("Could not listen for friend requests:", error)
    );
    return unsubscribe;
  }, [user?.uid]);

  // Live Messages list. Accepted friends are inserted here automatically.
  useEffect(() => {
    if (!user?.uid) { setMessageContacts([]); return; }
    const conversationsRef = collection(db, "users", user.uid, "conversations");
    const unsubscribe = onSnapshot(conversationsRef,
      snapshot => setMessageContacts(snapshot.docs.map(item => ({ uid: item.id, ...item.data() }))
        .sort((a, b) => (b.updatedAt?.toMillis?.() || 0) - (a.updatedAt?.toMillis?.() || 0))),
      error => console.error("Could not listen for message contacts:", error)
    );
    return unsubscribe;
  }, [user?.uid]);

  // Firebase authentication.

  useEffect(() => {

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {

      setUser(currentUser);
      if (currentUser) rememberAccount(currentUser);



      if (currentUser) {

        try {

          const snapshot = await getDoc(

            doc(db, "users", currentUser.uid)

          );



          const loadedProfile = snapshot.exists() ? snapshot.data() : null;

          // Backfill public directory entries for accounts created before this fix.
          // The document contains presentation fields only, never email or role.
          if (loadedProfile) {
            const publicRef = doc(db, "publicProfiles", currentUser.uid);
            const publicSnapshot = await getDoc(publicRef);
            if (!publicSnapshot.exists()) {
              const publicFields = [
                "displayName", "username", "bio", "avatarUrl", "bannerUrl",
                "accentColor", "cardColor", "borderColor", "nameColor", "nameSize",
                "fontFamily", "avatarShape", "avatarSize", "avatarBorderColor",
                "bannerHeight", "bannerPosition", "profileTheme", "profileLayout",
                "decoration", "badgeText", "website", "twitter", "telegram"
              ];
              const publicProfile = Object.fromEntries(
                publicFields
                  .filter((field) => loadedProfile[field] !== undefined)
                  .map((field) => [field, loadedProfile[field]])
              );
              await setDoc(publicRef, {
                uid: currentUser.uid,
                username: loadedProfile.username || loadedProfile.usernameLower || "",
                displayName: loadedProfile.displayName || currentUser.displayName || loadedProfile.username || "TrenchTalk member",
                bio: loadedProfile.bio || "",
                avatarUrl: loadedProfile.avatarUrl || currentUser.photoURL || "",
                ...publicProfile,
                updatedAt: serverTimestamp()
              }, { merge: true });
            }
          }

          setProfile(loadedProfile);
          setSavedAccounts((previous) => {
            const current = previous.find((item) => item.uid === currentUser.uid) || {};
            const merged = {
              ...current,
              uid: currentUser.uid,
              email: currentUser.email || current.email || "",
              displayName: loadedProfile?.displayName || currentUser.displayName || current.email?.split("@")[0] || "TrenchTalk member",
              username: loadedProfile?.username || current.username || "",
              avatarUrl: loadedProfile?.avatarUrl || currentUser.photoURL || current.avatarUrl || ""
            };
            const next = [merged, ...previous.filter((item) => item.uid !== currentUser.uid)]
              .filter((item, index, all) => item.uid && all.findIndex((entry) => entry.uid === item.uid) === index)
              .slice(0, 8);
            try { localStorage.setItem("tt-saved-accounts", JSON.stringify(next)); } catch {}
            return next;
          });

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



  // Live token services.

  useEffect(() => {

    const unsubscribeTrending = trendingService.subscribe((tokens) => {

      setTrendingTokens(tokens);

    });



    const unsubscribeNew = tokenService.subscribe(({ tokens, connected }) => {

      setNewTokens(tokens);

      setTokenConnected(connected);

    });



    trendingService.start();



    return () => {

      unsubscribeTrending();

      unsubscribeNew();

      trendingService.stop();

      tokenService.disconnect();

    };

  }, []);



  // Retry missing token images every ten minutes without blocking Trending.

  useEffect(() => {

    let cancelled = false;



    const refreshMissingImages = async () => {

      const combined = new Map();

      const sources = imageSourcesRef.current;

      const failedMints = failedImageMintsRef.current;



      [

        ...sources.newTokens,

        ...sources.trendingTokens,

        ...sources.searchResults

      ].forEach((token) => {

        if (!token?.mint) return;



        const image = token.imageUrl || token.market?.imageUrl;



        if (!image || failedMints.has(token.mint)) {

          combined.set(token.mint, token);

        }

      });



      const candidates = Array.from(combined.values());



      if (!candidates.length) return;



      try {

        let nextIndex = 0;

        const updates = new Map();



        const worker = async () => {

          while (nextIndex < candidates.length) {

            const token = candidates[nextIndex++];

            const imageUrl = await fetchTokenImage(token);



            if (imageUrl) {

              updates.set(token.mint, imageUrl);

            }

          }

        };



        await Promise.all(

          Array.from(

            { length: Math.min(5, candidates.length) },

            () => worker()

          )

        );



        if (cancelled || !updates.size) return;



        const mergeImages = (current) => current.map((token) => {

          const imageUrl = updates.get(token.mint);



          return imageUrl

            ? { ...token, imageUrl }

            : token;

        });



        setNewTokens(mergeImages);

        setTrendingTokens(mergeImages);

        setSearchResults(mergeImages);



        setFailedImageMints((current) => {

          const next = new Set(current);



          updates.forEach((_, mint) => next.delete(mint));



          return next;

        });

      } catch (error) {

        console.warn("[Token images] Refresh failed:", error);

      }

    };



    const interval = setInterval(

      refreshMissingImages,

      IMAGE_REFRESH_INTERVAL

    );



    return () => {

      cancelled = true;

      clearInterval(interval);

    };

  }, []);



  function handleTokenImageError(mint) {

    if (!mint) return;



    setFailedImageMints((current) => {

      const next = new Set(current);

      next.add(mint);

      return next;

    });



    const clearBrokenImage = (current) => current.map((token) =>

      token.mint === mint

        ? {

            ...token,

            imageUrl: null,

            market: {

              ...(token.market || {}),

              imageUrl: null

            }

          }

        : token

    );



    setNewTokens(clearBrokenImage);

    setTrendingTokens(clearBrokenImage);

    setSearchResults(clearBrokenImage);

  }



  // Update the clock so tokens become visible after ten minutes.

  useEffect(() => {

    const interval = setInterval(() => {

      setClock(Date.now());

    }, TOKEN_REFRESH_INTERVAL);



    return () => clearInterval(interval);

  }, []);



  // Search the entire stored token catalogue.

  useEffect(() => {

    const term = search.trim();



    if (!term || activePage !== "explore" || exploreTab !== "coins") {

      setSearchResults([]);

      setSearchLoading(false);

      return;

    }



    let cancelled = false;



    const timer = setTimeout(async () => {

      setSearchLoading(true);



      try {

        const matches = await tokenService.searchTokens(term);

        const enriched = await enrichTokens(matches);



        if (!cancelled) {

          setSearchResults(enriched);

        }

      } catch (error) {

        console.error("Token search failed:", error);



        if (!cancelled) {

          setSearchResults([]);

        }

      } finally {

        if (!cancelled) {

          setSearchLoading(false);

        }

      }

    }, 300);



    return () => {

      cancelled = true;

      clearTimeout(timer);

    };

  }, [search, activePage, exploreTab]);

  // Load each Explore collection at most once every five minutes.
  // Search is performed against the cached rows in memory, not by rereading Firestore.
  useEffect(() => {
    if (activePage !== "explore" || exploreTab === "coins") {
      setExploreSourceRows([]);
      setExploreResults([]);
      setExploreError("");
      setExploreLoading(false);
      return;
    }

    let cancelled = false;

    const collectionName =
      exploreTab === "trending"
        ? "posts"
        : exploreTab === "people"
          ? "publicProfiles"
          : "communities";

    async function loadExploreCollection() {
      setExploreLoading(true);
      setExploreError("");

      try {
        const cached = exploreCacheRef.current.get(collectionName);
        const cacheIsFresh =
          cached &&
          Date.now() - cached.loadedAt < 5 * 60 * 1000;

        let rows;

        if (cacheIsFresh) {
          rows = cached.rows;
        } else {
          // Hard cap the number of documents read per collection load.
          const collectionQuery = query(
            collection(db, collectionName),
            limit(50)
          );

          const snapshot = await getDocs(collectionQuery);
          rows = snapshot.docs.map((entry) => ({
            id: entry.id,
            ...entry.data()
          }));

          exploreCacheRef.current.set(collectionName, {
            rows,
            loadedAt: Date.now()
          });
        }

        if (exploreTab === "people") {
          rows = rows.filter((item) => item.id !== user?.uid);
        }

        if (!cancelled) {
          setExploreSourceRows(rows);
        }
      } catch (error) {
        console.error(`Explore ${exploreTab} lookup failed:`, error);

        if (!cancelled) {
          setExploreSourceRows([]);
          setExploreResults([]);
          setExploreError(
            `Couldn't load ${exploreTab}. Check that the "${collectionName}" collection exists and that Firestore rules permit reading it.`
          );
        }
      } finally {
        if (!cancelled) setExploreLoading(false);
      }
    }

    loadExploreCollection();

    return () => {
      cancelled = true;
    };
  }, [activePage, exploreTab, user?.uid]);

  // Filter and sort cached Explore data locally as the user types.
  useEffect(() => {
    if (activePage !== "explore" || exploreTab === "coins") return;

    const term = search.trim().toLowerCase();
    let rows = [...exploreSourceRows];

    if (term) {
      rows = rows.filter((item) => {
        const fields =
          exploreTab === "trending"
            ? [
                item.text,
                item.content,
                item.body,
                item.username,
                item.user,
                item.displayName,
                item.name,
                item.community
              ]
            : exploreTab === "people"
              ? [item.username, item.displayName, item.name, item.bio]
              : [
                  item.name,
                  item.title,
                  item.description,
                  item.slug,
                  item.handle
                ];

        return fields.some((value) =>
          String(value || "").toLowerCase().includes(term)
        );
      });
    }

    if (exploreTab === "trending") {
      const engagement = (item) =>
        Number(item.likesCount ?? item.likes ?? 0) +
        Number(item.commentsCount ?? item.comments ?? 0) +
        Number(item.repostsCount ?? item.reposts ?? 0);

      rows.sort((a, b) => engagement(b) - engagement(a));
    } else {
      rows.sort((a, b) =>
        String(
          a.displayName || a.name || a.username || a.title || ""
        ).localeCompare(
          String(
            b.displayName || b.name || b.username || b.title || ""
          )
        )
      );
    }

    setExploreResults(rows);
  }, [activePage, exploreTab, search, exploreSourceRows]);

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



    console.log("Post ready for submission:", postText.trim());

    setPostText("");



    alert(

      "Post publishing will be available when the feed database is connected."

    );

  }



 // Only show Shrine-detected tokens after ten minutes.

// Display the 15 newest eligible tokens.

const visibleNewTokens = useMemo(() => {

  return newTokens

    .filter((token) => {

      if (token.source !== "shrine") return false;



      const detectedAt = Number(

        token.detectedAtMs ||

        token.receivedAt ||

        (Number(token.timestamp) > 0

          ? Number(token.timestamp) * 1000

          : 0)

      );



      return (

        detectedAt > 0 &&

        clock - detectedAt >= NEW_TOKEN_DELAY

      );

    })

    .sort(

      (a, b) =>

        Number(b.detectedAtMs || 0) -

        Number(a.detectedAtMs || 0)

    )

    .slice(0, 15);

}, [newTokens, clock]);



useEffect(() => {

  let cancelled = false;



  const loadNewTokenMarketData = async () => {

    if (visibleNewTokens.length === 0) {

      setEnrichedNewTokens([]);

      return;

    }



    try {

      const enriched = await enrichTokens(visibleNewTokens, {

        includeMetadata: false,

      });



      if (!cancelled) {

        setEnrichedNewTokens(enriched);

      }

    } catch (error) {

      console.error("Failed to load New token market data:", error);



      if (!cancelled) {

        setEnrichedNewTokens((current) =>

          current.length > 0 ? current : visibleNewTokens

        );

      }

    }

  };



  loadNewTokenMarketData();



  return () => {

    cancelled = true;

  };

}, [visibleNewTokens]);



  const filteredNewTokens = useMemo(() => {

  if (search.trim()) return searchResults;



  return enrichedNewTokens.length > 0

    ? enrichedNewTokens

    : visibleNewTokens;

}, [search, searchResults, enrichedNewTokens, visibleNewTokens]);



  const filteredTrendingTokens = useMemo(() => {

    const source = search.trim() && activePage === "explore" && exploreTab === "coins" ? searchResults : trendingTokens;



    return [...source].sort((a, b) => {

      const volumeDifference =

        Number(b.market?.volume24h || 0) -

        Number(a.market?.volume24h || 0);



      if (volumeDifference !== 0) return volumeDifference;



      return (

        Number(b.market?.liquidity || 0) -

        Number(a.market?.liquidity || 0)

      );

    });

  }, [search, searchResults, trendingTokens, activePage, exploreTab]);



  if (authLoading) {

    return (

      <div className="tt-loading">

        <img src="/logo2.png" alt="TrenchTalk" />

        <span>LOADING TRENCHTALK</span>

      </div>

    );

  }



  // Public visitors see the countdown.

  // The admin passcode unlocks the login screen.

  if (!user) {

    return showLogin ? (

      <Login />

    ) : (

      <Countdown onLogin={() => setShowLogin(true)} />

    );

  }



  const pageTitles = {

    home: "Welcome to TrenchTalk",

    feed: "Your feed",

    explore: "Explore",

    notifications: "Notifications",

    messages: "Messages",

    communities: "Communities",

    bookmarks: "Saved posts",

    profile: "Your profile",
    "profile-customisation": "Profile customisation",

  };



  return (

    <div className="tt-dashboard">

      {/* SIDEBAR */}

      <aside className="tt-sidebar">

        <div className="tt-profile-area">
          <button
            type="button"
            className="tt-profile-button"
            onClick={() => navigate("profile")}
            aria-label="Open my profile"
          >
            <Avatar
              letter={username[0]?.toUpperCase()}
              imageUrl={profile?.avatarUrl}
            />
            <span className="tt-profile-details">
              <strong>{displayName}</strong>
              <small>@{username}</small>
            </span>
          </button>
        </div>


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
                {item.image ? (
                  <img src={item.icon} alt="" />
                ) : (
                  item.icon
                )}
              </span>



              <span className="tt-nav-label">

                {item.label}

              </span>

            </button>

          ))}

        </nav>



        <div className="tt-create-wrap" ref={createMenuRef}>
          <button
            type="button"
            className="tt-post-button"
            onClick={() => setCreateMenuOpen((open) => !open)}
            aria-expanded={createMenuOpen}
            aria-haspopup="menu"
          >
            <span>＋</span>
            Create
          </button>

          {createMenuOpen && (
            <div className="tt-create-menu" role="menu">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setCreateMenuOpen(false);
                  openPost();
                }}
              >
                <span className="tt-create-menu-icon">✎</span>
                <span>
                  <strong>Post</strong>
                  <small>Share something with the community</small>
                </span>
              </button>
              <button type="button" role="menuitem" disabled>
                <span className="tt-create-menu-icon">♧</span>
                <span>
                  <strong>Community</strong>
                  <small>Coming soon</small>
                </span>
              </button>
              <button type="button" role="menuitem" disabled>
                <span className="tt-create-menu-icon">◈</span>
                <span>
                  <strong>Coin room</strong>
                  <small>Coming soon</small>
                </span>
              </button>
            </div>
          )}
        </div>



        <div className="tt-sidebar-footer">

          <span className="tt-footer-dot" />

          <span>Community without limits.</span>

        </div>

      </aside>



      {/* MAIN CONTENT */}

      <main className="tt-main">





        <div className="tt-page">

          {/* FEED */}

          {(activePage === "home" || activePage === "feed") && (

            <section className="tt-feed">



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



              <EmptyState

                icon="◈"

                title="Nothing to see here yet."

                description="This is where posts from your community will appear. Check back later."

              />

            </section>

          )}





          {/* EXPLORE */}
          {activePage === "explore" && (
            <section className="tt-standard-page tt-explore">
              <div className="tt-page-heading">
                <div>
                  <span className="tt-eyebrow">DISCOVER TRENCHTALK</span>
                  <h1>Explore</h1>
                  <p>Find conversations, people, communities and coins.</p>
                </div>
              </div>

              <label className="tt-search tt-explore-search">
                <span>⌕</span>
                <input
                  type="search"
                  placeholder={
                    exploreTab === "trending" ? "Search posts and conversations..." :
                    exploreTab === "people" ? "Search people by name or username..." :
                    exploreTab === "communities" ? "Search communities..." :
                    "Search coins, tickers or paste a contract address..."
                  }
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>

              <div className="tt-market-tabs tt-explore-tabs" role="tablist" aria-label="Explore categories">
                {[["trending", "Trending"], ["people", "People"], ["communities", "Communities"], ["coins", "Coins"]].map(([id, label]) => (
                  <button key={id} role="tab" aria-selected={exploreTab === id} className={exploreTab === id ? "selected" : ""} onClick={() => setExploreTab(id)}>
                    {label}
                  </button>
                ))}
              </div>

              {exploreTab === "coins" ? (
                <>
                  <div className="tt-market-header">
                    <div><span className={`tt-live-indicator ${tokenConnected ? "" : "tt-live-offline"}`} />{tokenConnected ? "LIVE SOLANA DATA" : "CONNECTING TO SOLANA DATA"}</div>
                    <span>{search.trim() ? `${searchResults.length} coin results` : `${trendingTokens.length} trending coins`}</span>
                  </div>
                  {searchLoading ? <div className="tt-search-status">Searching the full token catalogue...</div> : filteredTrendingTokens.length ? (
                    <div className="tt-token-grid">
                      {filteredTrendingTokens.map((token, index) => <TokenCard key={token.mint} token={token} index={index} onImageError={handleTokenImageError} />)}
                    </div>
                  ) : (
                    <EmptyState icon="⌕" title={search.trim() ? "No matching coins found." : "No trending coins available yet."} description={search.trim() ? "Try another name, ticker or contract address." : "Trending Solana tokens will appear here when market data is available."} />
                  )}
                </>
              ) : (
                <>
                  <div className="tt-market-header">
                    <div>{exploreTab === "trending" ? "TRENDING CONVERSATIONS" : exploreTab === "people" ? "DISCOVER PEOPLE" : "DISCOVER COMMUNITIES"}</div>
                    <span>{exploreLoading ? "Loading..." : `${exploreResults.length} ${exploreTab === "trending" ? "posts" : exploreTab}`}</span>
                  </div>
                  {exploreLoading ? <div className="tt-search-status">Loading {exploreTab}...</div> : exploreError ? (
                    <EmptyState icon="!" title="Explore data unavailable" description={exploreError} />
                  ) : exploreResults.length === 0 ? (
                    <EmptyState
                      icon={exploreTab === "trending" ? "▤" : exploreTab === "people" ? "◎" : "◈"}
                      title={search.trim() ? `No matching ${exploreTab === "trending" ? "posts" : exploreTab} found.` : exploreTab === "trending" ? "No trending conversations yet." : exploreTab === "people" ? "No people to discover yet." : "No communities to discover yet."}
                      description={search.trim() ? "Try a different search." : exploreTab === "trending" ? "Public posts will appear here as posts are connected to the TrenchTalk feed." : exploreTab === "people" ? "Public accounts will appear here. Use search to find someone." : "Communities will appear here when community records are available."}
                    />
                  ) : exploreTab === "people" ? (
                    <div className="tt-discovery-grid">
                      {exploreResults.map((person) => {
                        const personName = person.displayName || person.name || person.username || "TrenchTalk member";
                        const personUsername = person.username || person.handle || "";
                        return <article role="button" tabIndex={0} onClick={async () => {
                          try {
                            const latest = await getDoc(doc(db, "publicProfiles", person.id));
                            setViewingPublicProfile(latest.exists() ? { id: person.id, uid: person.id, ...latest.data() } : person);
                          } catch (error) {
                            console.warn("Could not refresh public profile:", error);
                            setViewingPublicProfile(person);
                          }
                          setActivePage("public-profile");
                        }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setViewingPublicProfile(person); setActivePage("public-profile"); } }} className="tt-discovery-card tt-person-card" key={person.id}>
                          <div className="tt-discovery-avatar">{person.avatarUrl ? <img src={person.avatarUrl} alt="" /> : personName[0]?.toUpperCase()}</div>
                          <div className="tt-discovery-copy"><strong>{personName}</strong><span>{personUsername ? `@${personUsername}` : "TrenchTalk member"}</span>{person.bio && <p>{person.bio}</p>}</div>
                        </article>;
                      })}
                    </div>
                  ) : exploreTab === "communities" ? (
                    <div className="tt-discovery-grid">
                      {exploreResults.map((community) => <article className="tt-discovery-card" key={community.id}>
                        <div className="tt-community-mark">◈</div>
                        <div className="tt-discovery-copy"><strong>{community.name || community.title || community.slug || "Community"}</strong><span>{community.memberCount ?? community.membersCount ?? 0} members</span>{(community.description || community.bio) && <p>{community.description || community.bio}</p>}</div>
                      </article>)}
                    </div>
                  ) : (
                    <div className="tt-discovery-posts">
                      {exploreResults.map((post) => <article className="tt-discovery-post" key={post.id}>
                        <div className="tt-discovery-post-meta"><strong>{post.displayName || post.name || post.username || post.user || "TrenchTalk member"}</strong><span>{post.username ? `@${post.username}` : ""}</span></div>
                        <p>{post.text || post.content || post.body || ""}</p>
                        <div className="tt-discovery-post-stats"><span>{post.likesCount ?? post.likes ?? 0} likes</span><span>{post.commentsCount ?? post.comments ?? 0} replies</span><span>{post.repostsCount ?? post.reposts ?? 0} reposts</span></div>
                      </article>)}
                    </div>
                  )}
                </>
              )}
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



              <EmptyState

                icon="◈"

                title="No communities yet."

                description="Your communities will appear here."

              />

            </section>

          )}



          {/* MESSAGES */}

          {activePage === "messages" && (
            <section className="tt-standard-page">
              <div className="tt-page-heading">
                <div>
                  <span className="tt-eyebrow">YOUR CONVERSATIONS</span>
                  <h1>Messages</h1>
                  <p>People you become friends with are added here automatically.</p>
                </div>
              </div>

              {messageContacts.length === 0 ? (
                <EmptyState
                  icon="✉"
                  title="No conversations yet."
                  description="Accept a friend request and that person will appear here automatically."
                />
              ) : (
                <div className="tt-message-contact-list">
                  {messageContacts.map((contact) => (
                    <article className="tt-message-contact" key={contact.uid}>
                      <Avatar letter={(contact.displayName || contact.username || "M").slice(0, 1).toUpperCase()} imageUrl={contact.avatarUrl} />
                      <div className="tt-message-contact-copy">
                        <strong>{contact.displayName || contact.username || "TrenchTalk member"}</strong>
                        <span>{contact.username ? `@${contact.username}` : "Friend"}</span>
                        <small>{contact.lastMessage || "You are now friends. Start a conversation soon."}</small>
                      </div>
                      <span className="tt-message-contact-status">FRIEND</span>
                    </article>
                  ))}
                </div>
              )}
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



              {friendRequests.length > 0 ? (
                <section className="tt-notification-list" aria-label="Friend request notifications">
                  {friendRequests.map(request => (
                    <article className="tt-notification-card" key={request.uid}>
                      <div className="tt-friend-request-avatar">{request.fromAvatarUrl ? <img src={request.fromAvatarUrl} alt="" /> : (request.fromName || "M")[0].toUpperCase()}</div>
                      <div className="tt-friend-request-copy">
                        <strong>{request.fromName || "A TrenchTalk member"} sent you a friend request</strong>
                        <span>{request.fromUsername ? `@${request.fromUsername}` : "Friend request"}</span>
                      </div>
                      <div className="tt-notification-actions">
                        <button type="button" onClick={() => handleFriendRequestDecision(request, true)}>Accept</button>
                        <button type="button" className="decline" onClick={() => handleFriendRequestDecision(request, false)}>Decline</button>
                      </div>
                    </article>
                  ))}
                </section>
              ) : (
                <EmptyState icon="♧" title="You're all caught up." description="New notifications will appear here." />
              )}

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



              <EmptyState

                icon="☆"

                title="No saved posts yet."

                description="Posts you save will appear here."

              />

            </section>

          )}



          {/* PROFILE */}

          {activePage === "profile" && (
            <ProfilePage
              user={user}
              profile={profile}
              onNavigate={navigate}
              onLogout={handleLogout}
              savedAccounts={savedAccounts}
              onAddAccount={() => openAccountManager()}
              onSelectAccount={selectRememberedAccount}
              onFriendRequestDecision={handleFriendRequestDecision}
              friendRequests={friendRequests}
            />
          )}

          {activePage === "public-profile" && viewingPublicProfile && (
            <ProfilePage
              user={{ uid: viewingPublicProfile.uid || viewingPublicProfile.id, displayName: viewingPublicProfile.displayName, email: "" }}
              profile={viewingPublicProfile}
              viewOnly
              onNavigate={(page) => { setActivePage(page === "profile" ? "explore" : page); }}
              onLogout={handleLogout}
              currentUid={user?.uid}
              socialState={socialState}
              onFollow={(follow) => handleFollow(viewingPublicProfile, follow)}
              onFriendRequest={() => handleFriendRequest(viewingPublicProfile)}
            />
          )}

          {activePage === "profile-customisation" && (
            <ProfileEditor
              user={user}
              profile={profile}
              onProfileUpdated={setProfile}
              onNavigate={navigate}
              onLogout={handleLogout}
              savedAccounts={savedAccounts}
              onAddAccount={() => openAccountManager()}
              onSelectAccount={selectRememberedAccount}
            />
          )}



        </div>

      </main>

      {accountModalOpen && (
        <div className="tt-account-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !accountBusy) setAccountModalOpen(false); }}>
          <section className="tt-account-modal" role="dialog" aria-modal="true" aria-labelledby="tt-account-modal-title">
            <button className="tt-account-modal-close" type="button" aria-label="Close" onClick={() => setAccountModalOpen(false)}>×</button>
            <span className="tt-account-modal-eyebrow">TRENCHTALK ACCOUNTS</span>
            <h2 id="tt-account-modal-title">Add or switch account</h2>
            <p className="tt-account-modal-description">Sign in to another account. Your current account will be remembered on this device. Passwords are never saved.</p>
            {savedAccounts.length > 0 && <div className="tt-account-saved-list">
              <span className="tt-account-section-label">REMEMBERED ACCOUNTS</span>
              {savedAccounts.map((item) => <button key={item.uid} type="button" className={`tt-account-saved-item ${user?.uid === item.uid ? "is-current" : ""}`} onClick={() => selectRememberedAccount(item)}>
                <span className="tt-account-saved-avatar">{item.avatarUrl ? <img src={item.avatarUrl} alt="" /> : (item.displayName || item.email)[0]?.toUpperCase()}</span>
                <span><strong>{item.displayName || item.email}</strong><small>{item.email}</small></span>
                {user?.uid === item.uid && <em>Active</em>}
              </button>)}
            </div>}
            <form className="tt-account-login-form" onSubmit={(event) => { event.preventDefault(); authenticateAnotherAccount("password"); }}>
              <label>Email address<input type="email" autoComplete="username" value={accountEmail} onChange={(event) => setAccountEmail(event.target.value)} placeholder="name@example.com" required /></label>
              <label>Password<input type="password" autoComplete="current-password" value={accountPassword} onChange={(event) => setAccountPassword(event.target.value)} placeholder="Enter password" required /></label>
              {accountError && <p className="tt-account-error" role="alert">{accountError}</p>}
              <button className="tt-account-primary" type="submit" disabled={accountBusy}>{accountBusy ? "Signing in…" : "Sign in to account"}</button>
            </form>
            <div className="tt-account-divider"><span>OR</span></div>
            <button className="tt-account-google" type="button" disabled={accountBusy} onClick={() => authenticateAnotherAccount("google")}>Continue with Google</button>
            <p className="tt-account-modal-footnote">For security, TrenchTalk does not save account passwords. Select a remembered account, then authenticate with its password or Google account to switch.</p>
          </section>
        </div>
      )}

    </div>

  );

}



export default App;