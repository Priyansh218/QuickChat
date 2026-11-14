
import { useEffect, useRef, useState } from "react";
import {
  Send, Users, MoreVertical, Trash2
} from "lucide-react";

function getDateLabel(dateString) {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date();

  yesterday.setDate(yesterday.getDate() - 1);

  const isSameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (isSameDay(date, today)) return "Today";
  if (isSameDay(date, yesterday)) return "Yesterday";

  return date.toLocaleDateString([], {
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

export default function ChatWindow({
  group, user, api, onGroupInfo
}) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [deletingMessageId, setDeletingMessageId] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (!group) return;

    let active = true;

    async function loadMessages() {
      try {
        const result = await api.getMessages(group.id);
        if (active) {
          setMessages(result.messages);
          setError("");
        }
      } catch (err) {
        if (active) setError(err.message);
      }
    }

    setMessages([]);
    loadMessages();

    const interval = setInterval(loadMessages, 3000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [group?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(e) {
    e.preventDefault();

    if (!text.trim() || sending) return;

    const messageText = text.trim();
    setText("");
    setSending(true);
    setError("");

    try {
      await api.sendMessage(group.id, messageText);
      const result = await api.getMessages(group.id);
      setMessages(result.messages);
    } catch (err) {
      setText(messageText);
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  async function handleDelete(messageId) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this message? It will disappear for everyone in the group."
    );

    if (!confirmed || deletingMessageId) return;

    setDeletingMessageId(messageId);
    setError("");

    try {
      await api.deleteMessage(group.id, messageId);

      const result = await api.getMessages(group.id);
      setMessages(result.messages);
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingMessageId(null);
    }
  }

  if (!group) {
    return (
      <main className="chat-empty">
        <div className="empty-icon"><Users size={34} /></div>
        <h2>Welcome to QuickChat</h2>
        <p>Select a group to start a conversation.</p>
      </main>
    );
  }

  return (
    <main className="chat-window">
      <header className="chat-header">
        <div className="group-avatar">
          <Users size={21} />
        </div>

        <div className="chat-heading">
          <h3>{group.name}</h3>
          <span>{group.memberCount} members</span>
        </div>

        <button type="button" className="icon-btn" onClick={onGroupInfo} title="Group information"
          aria-label="Group information">
          <MoreVertical size={21} />
        </button>
      </header>

      <div className="messages-area">
        <div className="conversation-intro">
          <div className="group-avatar large"><Users size={28} /></div>
          <h2>{group.name}</h2>
          <p>{group.description || "Welcome to the group conversation."}</p>
          <span>Messages are visible to group members.</span>
        </div>

        {messages.map((message, index) => {
          const own = message.senderId === user.id;
          const currentDate = new Date(message.createdAt).toDateString();

          const previousDate = index > 0 ? new Date(messages[index - 1].createdAt).toDateString() : null;

          const showDateSeparator = currentDate !== previousDate;
          return (
            <div key={message.id}>
              {showDateSeparator && (
                <div className="date-separator">
                  <span>{getDateLabel(message.createdAt)}</span>
                </div>
              )}

              <div
                className={`message-row ${own ? "own-message" : ""}`}
              >
                {!own && (
                  <div className="message-avatar">
                    {message.senderName?.charAt(0).toUpperCase()}
                  </div>
                )}

                <div className="message-content">
                  {!own && (
                    <span className="sender-name">
                      {message.senderName}
                    </span>
                  )}

                  <div className="message-bubble-wrapper">
                    <div className="message-bubble">
                      {message.text}
                    </div>

                    {own && (
                      <button
                        type="button"
                        className="delete-message-btn"
                        onClick={() => handleDelete(message.id)}
                        disabled={deletingMessageId !== null}
                        title="Delete message"
                        aria-label="Delete message"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>

                  <span className="message-time">
                    {new Date(message.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit"
                    })}
                  </span>
                </div>
              </div>
            </div>
          );
        })}

        {error && <p className="chat-error">{error}</p>}
        <div ref={bottomRef} />
      </div>

      <form className="message-composer" onSubmit={handleSend}>
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={`Message ${group.name}...`}
          maxLength={2000}
        />
        <button type="submit" disabled={!text.trim() || sending}>
          <Send size={19} />
        </button>
      </form>
    </main>
  );
}
