import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addDoc, collection, deleteDoc, doc, getDoc, limit, onSnapshot, orderBy,
  query, serverTimestamp, setDoc, updateDoc, where
} from "firebase/firestore";
import { db } from "../firebase";

const CLOUDINARY_CLOUD_NAME = "uv53gojj";
const CLOUDINARY_UPLOAD_PRESET = "trenchtalk_uploads";

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const EMOJIS = ["👍", "❤️", "😂", "🔥", "👀", "🎉"];

function stamp(value) {
  const date = value?.toDate ? value.toDate() : value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function Avatar({ contact, size = "normal" }) {
  const label = (contact?.displayName || contact?.username || "M").slice(0, 1).toUpperCase();
  return <div className={`ttdm-avatar ${size}`}>{contact?.avatarUrl ? <img src={contact.avatarUrl} alt="" /> : label}</div>;
}
function fileKind(file) {
  if (file?.type?.startsWith("image/")) return "image";
  if (file?.type?.startsWith("video/")) return "video";
  return "file";
}

export default function Messages({ user, profile, contacts = [] }) {
  const [activeUid, setActiveUid] = useState("");
  const [messages, setMessages] = useState([]);
  const [conversationReady, setConversationReady] = useState(false);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [editingId, setEditingId] = useState("");
  const [editingText, setEditingText] = useState("");
  const [typingUsers, setTypingUsers] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [filePreview, setFilePreview] = useState(null);
  const bottomRef = useRef(null);
  const typingTimer = useRef(null);
  const fileInput = useRef(null);
  const activeContact = contacts.find(c => c.uid === activeUid) || null;
  const conversationId = useMemo(() => activeUid && user?.uid ? [user.uid, activeUid].sort().join("_") : "", [user?.uid, activeUid]);
  const filteredContacts = contacts.filter(c => `${c.displayName || ""} ${c.username || ""}`.toLowerCase().includes(searchTerm.toLowerCase()));

  useEffect(() => {
    if (!activeUid && contacts.length) setActiveUid(contacts[0].uid);
    if (activeUid && !contacts.some(c => c.uid === activeUid)) setActiveUid(contacts[0]?.uid || "");
  }, [contacts, activeUid]);

  // Watch the parent conversation first. A brand-new conversation has no
  // messages/typing subcollections yet, so those listeners must wait until the
  // parent document exists.
  useEffect(() => {
    setMessages([]);
    setTypingUsers([]);
    setConversationReady(false);
    setError("");
    if (!conversationId || !user?.uid) return;

    const conversationRef = doc(db, "conversations", conversationId);
    const unsubscribe = onSnapshot(conversationRef, snapshot => {
      if (!snapshot.exists()) {
        setConversationReady(false);
        setMessages([]);
        setTypingUsers([]);
        return;
      }
      const participants = snapshot.data()?.participants || [];
      if (!participants.includes(user.uid) || !participants.includes(activeUid)) {
        setConversationReady(false);
        setError("You do not have access to this conversation.");
        return;
      }
      setConversationReady(true);
      setError("");
    }, err => {
      console.error("Conversation listener failed:", err);
      setConversationReady(false);
      setError(`Could not open this conversation: ${err.code || err.message}`);
    });
    return unsubscribe;
  }, [conversationId, user?.uid, activeUid]);

  useEffect(() => {
    if (!conversationId || !user?.uid || !conversationReady) {
      setMessages([]);
      return;
    }
    const messagesRef = collection(db, "conversations", conversationId, "messages");
    const q = query(messagesRef, orderBy("createdAt", "asc"), limit(200));
    const unsubscribe = onSnapshot(q, snapshot => {
      setMessages(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      snapshot.docs.forEach(messageDoc => {
        const data = messageDoc.data();
        if (data.senderUid !== user.uid && !data.readBy?.includes(user.uid)) {
          updateDoc(messageDoc.ref, { readBy: [...(data.readBy || []), user.uid], readAt: serverTimestamp() }).catch(err => {
            console.warn("Could not update message read receipt:", err);
          });
        }
      });
    }, err => {
      console.error("Message listener failed:", err);
      setError(`Could not load messages: ${err.code || err.message}`);
    });
    return unsubscribe;
  }, [conversationId, user?.uid, conversationReady]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages.length, activeUid]);

  useEffect(() => {
    if (!conversationId || !user?.uid || !conversationReady) {
      setTypingUsers([]);
      return;
    }
    const typingRef = collection(db, "conversations", conversationId, "typing");
    const unsubscribe = onSnapshot(typingRef, snap => {
      const now = Date.now();
      setTypingUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() })).filter(t => t.uid !== user.uid && t.updatedAt?.toMillis && now - t.updatedAt.toMillis() < 6000));
    }, err => {
      console.warn("Typing listener failed:", err);
    });
    return unsubscribe;
  }, [conversationId, user?.uid, conversationReady]);

  useEffect(() => () => clearTimeout(typingTimer.current), []);

  const ensureConversation = useCallback(async () => {
    if (!user?.uid || !activeUid) throw new Error("Choose a friend first.");
    const id = [user.uid, activeUid].sort().join("_");
    const refDoc = doc(db, "conversations", id);
    const existing = await getDoc(refDoc);

    if (existing.exists()) {
      const participants = existing.data()?.participants || [];
      if (!participants.includes(user.uid) || !participants.includes(activeUid)) {
        throw new Error("This conversation does not belong to these two accounts.");
      }
      return id;
    }

    const [myFriend, theirFriend] = await Promise.all([
      getDoc(doc(db, "users", user.uid, "friends", activeUid)),
      getDoc(doc(db, "users", activeUid, "friends", user.uid))
    ]);
    if (!myFriend.exists() || !theirFriend.exists()) {
      throw new Error("You can only message accepted friends.");
    }

    try {
      await setDoc(refDoc, {
        participants: [user.uid, activeUid].sort(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastMessage: ""
      });
    } catch (createError) {
      // Another tab/device may have created it between getDoc and setDoc.
      const raced = await getDoc(refDoc);
      const participants = raced.exists() ? raced.data()?.participants || [] : [];
      if (!participants.includes(user.uid) || !participants.includes(activeUid)) {
        throw createError;
      }
    }
    return id;
  }, [user?.uid, activeUid]);

  async function updateTyping(value) {
    setDraft(value);
    if (!conversationId || !user?.uid || !conversationReady) return;
    const typingRef = doc(db, "conversations", conversationId, "typing", user.uid);
    try {
      if (value.trim()) await setDoc(typingRef, { uid: user.uid, displayName: profile?.displayName || user.displayName || "Someone", updatedAt: serverTimestamp() });
      clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => deleteDoc(typingRef).catch(() => {}), 3500);
    } catch {}
  }

  async function sendMessage(event) {
    event?.preventDefault();
    if (!draft.trim() || !activeUid || sending) return;
    setSending(true); setError("");
    try {
      const id = await ensureConversation();
      const text = draft.trim();
      const messageRef = await addDoc(collection(db, "conversations", id, "messages"), {
        senderUid: user.uid, senderName: profile?.displayName || user.displayName || user.email?.split("@")[0] || "Member",
        senderAvatarUrl: profile?.avatarUrl || user.photoURL || "", text, type: "text", createdAt: serverTimestamp(),
        readBy: [user.uid], ...(replyTo ? { replyTo: { id: replyTo.id, text: replyTo.text || replyTo.attachment?.name || "Attachment", senderName: replyTo.senderName || "Member" } } : {})
      });
      await updateDoc(doc(db, "conversations", id), { lastMessage: text.slice(0, 180), lastMessageAt: serverTimestamp(), updatedAt: serverTimestamp(), lastSenderUid: user.uid });
      await Promise.all([
        setDoc(doc(db, "users", user.uid, "conversations", activeUid), { uid: activeUid, conversationId: id, lastMessage: text.slice(0, 180), updatedAt: serverTimestamp() }, { merge: true }),
        setDoc(doc(db, "users", activeUid, "conversations", user.uid), { uid: user.uid, conversationId: id, lastMessage: text.slice(0, 180), updatedAt: serverTimestamp(), unreadCount: 1 }, { merge: true })
      ]);
      setDraft(""); setReplyTo(null);
      deleteDoc(doc(db, "conversations", id, "typing", user.uid)).catch(() => {});
    } catch (err) { console.error("Send message failed:", err); setError(err.message || "Message could not be sent."); }
    finally { setSending(false); }
  }

  async function sendAttachment(file) {
    if (!file || !activeUid) return;
    if (file.size > MAX_FILE_BYTES) { setError("Files must be 20 MB or smaller."); return; }
    setUploading(true); setError("");
    try {
      const id = await ensureConversation();
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
      // The preset places uploads in the configured trenchtalk folder.
      const uploadResponse = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`, {
        method: "POST",
        body: formData
      });
      const uploaded = await uploadResponse.json();
      if (!uploadResponse.ok || !uploaded.secure_url) {
        throw new Error(uploaded.error?.message || "Cloudinary could not upload this file.");
      }
      const kind = fileKind(file);
      await addDoc(collection(db, "conversations", id, "messages"), {
        senderUid: user.uid, senderName: profile?.displayName || user.displayName || "Member", senderAvatarUrl: profile?.avatarUrl || "",
        text: "", type: kind, attachment: { name: file.name, size: file.size, contentType: file.type, url: uploaded.secure_url, publicId: uploaded.public_id, resourceType: uploaded.resource_type, format: uploaded.format },
        createdAt: serverTimestamp(), readBy: [user.uid]
      });
      await updateDoc(doc(db, "conversations", id), { lastMessage: kind === "image" ? "📷 Image" : kind === "video" ? "🎬 Video" : `📎 ${file.name}`, lastMessageAt: serverTimestamp(), updatedAt: serverTimestamp(), lastSenderUid: user.uid });
      await Promise.all([
        setDoc(doc(db, "users", user.uid, "conversations", activeUid), { uid: activeUid, conversationId: id, lastMessage: kind === "image" ? "📷 Image" : `📎 ${file.name}`, updatedAt: serverTimestamp() }, { merge: true }),
        setDoc(doc(db, "users", activeUid, "conversations", user.uid), { uid: user.uid, conversationId: id, lastMessage: kind === "image" ? "📷 Image" : `📎 ${file.name}`, updatedAt: serverTimestamp(), unreadCount: 1 }, { merge: true })
      ]);
    } catch (err) { console.error("Attachment upload failed:", err); setError(err.message || "Attachment upload failed."); }
    finally { setUploading(false); if (fileInput.current) fileInput.current.value = ""; }
  }

  async function editMessage(message) {
    if (!editingText.trim()) return;
    try { await updateDoc(doc(db, "conversations", conversationId, "messages", message.id), { text: editingText.trim(), edited: true, editedAt: serverTimestamp() }); setEditingId(""); setEditingText(""); }
    catch (err) { setError("Could not edit this message."); }
  }
  async function removeMessage(message) {
    if (!window.confirm("Delete this message for everyone?")) return;
    try { await updateDoc(doc(db, "conversations", conversationId, "messages", message.id), { deleted: true, text: "This message was deleted.", attachment: null, deletedAt: serverTimestamp() }); }
    catch (err) { setError("Could not delete this message."); }
  }
  async function react(message, emoji) {
    const current = message.reactions || {};
    const users = current[emoji] || [];
    const next = users.includes(user.uid) ? users.filter(uid => uid !== user.uid) : [...users, user.uid];
    try { await updateDoc(doc(db, "conversations", conversationId, "messages", message.id), { [`reactions.${emoji}`]: next }); }
    catch (err) { setError("Could not update reaction."); }
  }

  return <section className="ttdm-shell">
    <aside className="ttdm-sidebar">
      <div className="ttdm-sidebar-head"><div><span className="tt-eyebrow">YOUR INBOX</span><h1>Messages</h1></div><span className="ttdm-count">{contacts.length}</span></div>
      <label className="ttdm-search"><span>⌕</span><input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Find a friend" /></label>
      <div className="ttdm-section-label">DIRECT MESSAGES</div>
      <div className="ttdm-contact-scroll">{filteredContacts.map(contact => <button key={contact.uid} className={`ttdm-contact ${activeUid === contact.uid ? "active" : ""}`} onClick={() => { setActiveUid(contact.uid); setMobileChatOpen(true); setError(""); }}>
        <Avatar contact={contact} /><span className="ttdm-contact-meta"><strong>{contact.displayName || contact.username || "TrenchTalk member"}</strong><small>{contact.lastMessage || (contact.username ? `@${contact.username}` : "Friend")}</small></span>{Number(contact.unreadCount) > 0 && <i className="ttdm-unread">{contact.unreadCount > 99 ? "99+" : contact.unreadCount}</i>}
      </button>)}{filteredContacts.length === 0 && <div className="ttdm-no-contacts">{contacts.length ? "No friends match that search." : "Friends you accept will appear here."}</div>}</div>
    </aside>
    <main className={`ttdm-chat ${mobileChatOpen ? "mobile-open" : ""}`}>
      {activeContact ? <>
        <header className="ttdm-chat-head"><button className="ttdm-mobile-back" onClick={() => setMobileChatOpen(false)}>‹</button><Avatar contact={activeContact} /><div><strong>{activeContact.displayName || activeContact.username || "TrenchTalk member"}</strong><small>{activeContact.username ? `@${activeContact.username}` : "Friend"}</small></div><span className="ttdm-encrypted-label">DIRECT MESSAGE</span></header>
        <div className="ttdm-message-scroll">
          <div className="ttdm-welcome"><Avatar contact={activeContact} size="large" /><h2>{activeContact.displayName || activeContact.username || "Your friend"}</h2><p>This is the beginning of your direct message history.</p></div>
          {messages.map(message => {
            const mine = message.senderUid === user.uid;
            return <article key={message.id} className={`ttdm-message ${mine ? "mine" : "theirs"}`}>
              <Avatar contact={{ displayName: message.senderName, avatarUrl: message.senderAvatarUrl }} />
              <div className="ttdm-message-body"><div className="ttdm-message-meta"><strong>{mine ? "You" : (message.senderName || activeContact.displayName || "Friend")}</strong><time>{stamp(message.createdAt)}</time>{message.edited && <small>edited</small>}</div>
                {message.replyTo && <div className="ttdm-reply-quote"><b>{message.replyTo.senderName}</b><span>{message.replyTo.text}</span></div>}
                {message.deleted ? <p className="ttdm-deleted">This message was deleted.</p> : editingId === message.id ? <div className="ttdm-edit-box"><input value={editingText} onChange={e => setEditingText(e.target.value)} onKeyDown={e => e.key === "Enter" && editMessage(message)} /><button onClick={() => editMessage(message)}>Save</button><button onClick={() => setEditingId("")}>Cancel</button></div> : <>
                  {message.text && <p className="ttdm-message-text">{message.text}</p>}
                  {message.attachment?.url && <div className="ttdm-attachment">{message.type === "image" ? <a href={message.attachment.url} target="_blank" rel="noreferrer"><img src={message.attachment.url} alt={message.attachment.name} /></a> : message.type === "video" ? <video src={message.attachment.url} controls preload="metadata" /> : <a className="ttdm-file-card" href={message.attachment.url} target="_blank" rel="noreferrer" download><span>↧</span><div><b>{message.attachment.name}</b><small>{(message.attachment.size / 1024 / 1024).toFixed(2)} MB · Download</small></div></a>}</div>}
                </>}
                {!message.deleted && <div className="ttdm-message-tools"><button title="Reply" onClick={() => setReplyTo(message)}>↩</button>{EMOJIS.map(emoji => <button key={emoji} title={`React ${emoji}`} onClick={() => react(message, emoji)}>{emoji}</button>)}{mine && <><button title="Edit" onClick={() => { setEditingId(message.id); setEditingText(message.text || ""); }}>✎</button><button title="Delete" onClick={() => removeMessage(message)}>⌫</button></>}</div>}
                {message.reactions && <div className="ttdm-reactions">{Object.entries(message.reactions).filter(([, ids]) => ids?.length).map(([emoji, ids]) => <button key={emoji} className={ids.includes(user.uid) ? "selected" : ""} onClick={() => react(message, emoji)}>{emoji} {ids.length}</button>)}</div>}
                {mine && <small className="ttdm-read-state">{(message.readBy || []).includes(activeUid) ? "Seen" : "Sent"}</small>}
              </div>
            </article>;
          })}
          {typingUsers.length > 0 && <div className="ttdm-typing">{activeContact.displayName || "Your friend"} is typing…</div>}
          <div ref={bottomRef} />
        </div>
        {replyTo && <div className="ttdm-replying"><span>Replying to <b>{replyTo.senderName || "message"}</b></span><button onClick={() => setReplyTo(null)}>×</button></div>}
        {error && <div className="ttdm-error" role="alert">{error}</div>}
        <form className="ttdm-composer" onSubmit={sendMessage}>
          <input ref={fileInput} type="file" hidden onChange={e => sendAttachment(e.target.files?.[0])} accept="image/*,video/*,.pdf,.doc,.docx,.txt,.csv,.zip,.ppt,.pptx,.xls,.xlsx" />
          <button type="button" className="ttdm-attach" title="Attach a file" disabled={uploading} onClick={() => fileInput.current?.click()}>{uploading ? "…" : "+"}</button>
          <input value={draft} onChange={e => updateTyping(e.target.value)} placeholder={`Message ${activeContact.displayName || activeContact.username || "your friend"}`} maxLength={4000} />
          <button type="button" className="ttdm-emoji" title="Add a reaction" onClick={() => updateTyping(draft + " 🙂")}>☺</button>
          <button className="ttdm-send" type="submit" disabled={!draft.trim() || sending}>➤</button>
        </form>
        <div className="ttdm-composer-hint">Enter to send · Attachments up to 20 MB</div>
      </> : <div className="ttdm-empty-chat"><div>✉</div><h2>Your conversations, in one place.</h2><p>Choose a friend to start messaging.</p></div>}
    </main>
  </section>;
}
