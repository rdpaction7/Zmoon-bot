import { useEffect, useRef, useState } from "react";
import { useAuth } from "../state/AuthContext";
import {
  listConversations,
  markConversationRead,
  sendMessage,
  watchMessages,
} from "../lib/api";
import type { Conversation, Message, UserProfile } from "../lib/types";
import { Avatar, Button, Card, EmptyState, Input, Skeleton, useToast } from "../components/ui";

export default function Messages() {
  const { user, isDemo } = useAuth();
  const { push } = useToast();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!user) return;
    listConversations(user.id)
      .then((items) => {
        setConversations(items);
        if (items.length > 0) setActiveId(items[0].id);
      })
      .catch((caught) => setError(caught?.message || "Could not load conversations."))
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }
    const stop = watchMessages(activeId, setMessages);
    const conversation = conversations.find((entry) => entry.id === activeId);
    if (conversation && user) {
      markConversationRead(conversation, user.id).catch(() => {});
    }
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const active = conversations.find((entry) => entry.id === activeId) || null;
  const peerId = active?.participants.find((entry) => entry !== user?.id) || "";
  const peerName = active ? active.participantNames?.[peerId] || "Member" : "";

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!user || !active || !text.trim()) return;
    if (isDemo) return push("Demo accounts cannot send messages.", "error");
    const value = text;
    setText("");
    try {
      await sendMessage(active, user as UserProfile, value);
    } catch (caught: any) {
      setText(value);
      push(caught?.message || "Message could not be sent.", "error");
    }
  }

  const visibleConversations = conversations.filter((conversation) => {
    if (!search.trim()) return true;
    const name = Object.values(conversation.participantNames || {}).join(" ");
    return `${name} ${conversation.lastMessage}`.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="page">
      <header className="section-head">
        <span className="eyebrow">Messages</span>
        <h1>Conversations</h1>
        <p className="muted">Messaging is free and always will be.</p>
      </header>

      {error && <p className="error-text">{error}</p>}

      {loading ? (
        <Skeleton lines={5} />
      ) : conversations.length === 0 ? (
        <EmptyState
          title="No conversations yet"
          body="Accept a swap request or message a member from their profile to start one."
        />
      ) : (
        <div className="messaging">
          <aside className="conv-list">
            <Input
              placeholder="Search conversations"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search conversations"
            />
            {visibleConversations.map((conversation) => {
              const other = conversation.participants.find((entry) => entry !== user?.id) || "";
              const unread = conversation.unread?.[user?.id || ""] || 0;
              return (
                <button
                  key={conversation.id}
                  className={`conv ${conversation.id === activeId ? "conv-active" : ""}`}
                  onClick={() => setActiveId(conversation.id)}
                >
                  <Avatar name={conversation.participantNames?.[other] || "Member"} size={34} />
                  <span className="conv-copy">
                    <strong>{conversation.participantNames?.[other] || "Member"}</strong>
                    <span className="muted small clamp-1">
                      {conversation.lastMessage || "Say hello"}
                    </span>
                  </span>
                  {unread > 0 && <span className="unread-dot">{unread}</span>}
                </button>
              );
            })}
          </aside>

          <Card className="chat">
            <header className="chat-head">
              <Avatar name={peerName} size={32} />
              <div>
                <strong>{peerName}</strong>
                <p className="muted small">Private conversation</p>
              </div>
            </header>

            <div className="bubbles">
              {messages.length === 0 ? (
                <p className="muted small center">No messages yet. Start the conversation.</p>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`bubble ${message.senderId === user?.id ? "bubble-mine" : ""}`}
                  >
                    <span>{message.text}</span>
                    <time className="bubble-time">
                      {new Date(message.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                  </div>
                ))
              )}
              <div ref={bottomRef} />
            </div>

            <form className="composer" onSubmit={send}>
              <Input
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder={isDemo ? "Demo accounts cannot send messages" : "Write a message…"}
                disabled={isDemo}
                aria-label="Message"
              />
              <Button type="submit" disabled={isDemo || !text.trim()}>
                Send
              </Button>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
