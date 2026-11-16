import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../state/AuthContext";
import {
  listConversations,
  markConversationRead,
  sendMessage,
  watchMessages,
} from "../lib/api";
import type { Conversation, Message, UserProfile } from "../lib/types";
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  Input,
  SearchInput,
  Skeleton,
  useToast,
} from "../components/ui";
import { Icon } from "../components/icons";

export default function Messages() {
  const { user, isDemo } = useAuth();
  const { push } = useToast();
  const [params] = useSearchParams();
  const requestedId = params.get("c") || "";
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const conversationsRef = useRef<Conversation[]>([]);

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    listConversations(user.id)
      .then((items) => {
        setConversations(items);
        const hasRequested = Boolean(requestedId && items.some((entry) => entry.id === requestedId));
        const preferred = hasRequested ? requestedId : items[0]?.id || "";
        setActiveId((current) =>
          hasRequested ? requestedId : items.some((entry) => entry.id === current) ? current : preferred,
        );
        if (hasRequested) setChatOpen(true);
      })
      .catch((caught) => setError(caught?.message || "Could not load conversations."))
      .finally(() => setLoading(false));
  }, [user, requestedId]);

  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }
    setMessages([]);
    const stop = watchMessages(activeId, setMessages);
    const conversation = conversationsRef.current.find((entry) => entry.id === activeId);
    if (conversation && user && Number(conversation.unread?.[user.id] || 0) > 0) {
      setConversations((current) =>
        current.map((entry) =>
          entry.id === activeId ? { ...entry, unread: { ...entry.unread, [user.id]: 0 } } : entry,
        ),
      );
      markConversationRead(conversation, user.id).catch(() => {});
    }
    return stop;
  }, [activeId, user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const active = conversations.find((entry) => entry.id === activeId) || null;
  const peerId = active?.participants.find((entry) => entry !== user?.id) || "";
  const peerName = active ? active.participantNames?.[peerId] || "Member" : "";

  function selectConversation(conversation: Conversation) {
    setActiveId(conversation.id);
    setChatOpen(true);
    if (user && Number(conversation.unread?.[user.id] || 0) > 0) {
      setConversations((current) =>
        current.map((entry) =>
          entry.id === conversation.id
            ? { ...entry, unread: { ...entry.unread, [user.id]: 0 } }
            : entry,
        ),
      );
      markConversationRead(conversation, user.id).catch(() => {});
    }
  }

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!user || !active || !text.trim()) return;
    if (isDemo) return push("Demo accounts cannot send messages.", "error");
    const value = text.trim();
    setText("");
    try {
      await sendMessage(active, user as UserProfile, value);
      const stamp = new Date().toISOString();
      setConversations((current) =>
        current
          .map((entry) =>
            entry.id === active.id
              ? {
                  ...entry,
                  lastMessage: value.slice(0, 140),
                  lastMessageAt: stamp,
                  unread: { ...entry.unread, [user.id]: 0 },
                }
              : entry,
          )
          .sort((a, b) => (a.lastMessageAt < b.lastMessageAt ? 1 : -1)),
      );
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
      <header className="section-head between">
        <div>
          <span className="eyebrow">Messages</span>
          <h1>Conversations</h1>
          <p className="muted">Messaging is free and always will be.</p>
        </div>
      </header>

      {error && <p className="error-text">{error}</p>}

      {loading ? (
        <Skeleton lines={5} />
      ) : conversations.length === 0 ? (
        <EmptyState
          icon="chat"
          title="No conversations yet"
          body="Accept a swap request or open a member's profile and press Message to start one."
        />
      ) : (
        <div className={`messaging ${chatOpen ? "messaging-chat-open" : ""}`}>
          <aside className="conv-list" aria-label="Conversations">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search conversations"
              label="Search conversations"
            />
            {visibleConversations.length === 0 ? (
              <p className="muted small center" style={{ padding: "1.4rem 0" }}>
                No conversations match that search.
              </p>
            ) : (
              visibleConversations.map((conversation) => {
                const other = conversation.participants.find((entry) => entry !== user?.id) || "";
                const unread = conversation.unread?.[user?.id || ""] || 0;
                return (
                  <button
                    key={conversation.id}
                    className={`conv ${conversation.id === activeId ? "conv-active" : ""}`}
                    onClick={() => selectConversation(conversation)}
                  >
                    <Avatar name={conversation.participantNames?.[other] || "Member"} size={36} />
                    <span className="conv-copy">
                      <strong>{conversation.participantNames?.[other] || "Member"}</strong>
                      <span className="muted small clamp-1">
                        {conversation.lastMessage || "Say hello"}
                      </span>
                    </span>
                    {unread > 0 && <span className="unread-dot">{unread > 9 ? "9+" : unread}</span>}
                  </button>
                );
              })
            )}
          </aside>

          {active ? (
            <Card className="chat">
              <header className="chat-head">
                <button
                  type="button"
                  className="chat-back"
                  onClick={() => setChatOpen(false)}
                  aria-label="Back to conversations"
                >
                  <Icon name="arrowLeft" />
                </button>
                <Avatar name={peerName} size={34} />
                <div>
                  <strong>{peerName}</strong>
                  <p className="muted small">Private conversation</p>
                </div>
              </header>

              <div className="bubbles" role="log" aria-live="polite" aria-label={`Messages with ${peerName}`}>
                {messages.length === 0 ? (
                  <p className="muted small center">No messages yet. Start the conversation.</p>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={`bubble ${message.senderId === user?.id ? "bubble-mine" : ""}`}
                    >
                      <span>{message.text}</span>
                      <time className="bubble-time" dateTime={message.createdAt}>
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
                <Button type="submit" disabled={isDemo || !text.trim()} aria-label="Send message">
                  Send
                </Button>
              </form>
            </Card>
          ) : (
            <Card className="chat">
              <div className="messaging-empty">
                <div>
                  <span className="empty-icon" aria-hidden="true">
                    <Icon name="chat" />
                  </span>
                  <h3>Choose a conversation</h3>
                  <p className="muted small">Pick a member on the left to read the thread.</p>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
