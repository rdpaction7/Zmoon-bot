import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../state/AuthContext";
import { listNotifications, markAllNotificationsRead, markNotificationRead } from "../lib/api";
import type { AppNotification } from "../lib/types";
import { Badge, Button, Card, EmptyState, Skeleton, useToast } from "../components/ui";

export default function Notifications() {
  const { user } = useAuth();
  const { push } = useToast();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    if (!user) return;
    try {
      setItems(await listNotifications(user.id));
      setError("");
    } catch (caught: any) {
      setError(caught?.message || "Could not load notifications.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function markAll() {
    try {
      await markAllNotificationsRead(items);
      push("All notifications marked as read.", "success");
      await load();
    } catch (caught: any) {
      push(caught?.message || "Could not update notifications.", "error");
    }
  }

  const unread = items.filter((item) => !item.read).length;

  return (
    <div className="page page-narrow">
      <header className="section-head between">
        <div>
          <span className="eyebrow">Activity</span>
          <h1>Notifications</h1>
          <p className="muted">{unread === 0 ? "You are all caught up." : `${unread} unread`}</p>
        </div>
        {unread > 0 && (
          <Button size="sm" variant="secondary" onClick={markAll}>
            Mark all read
          </Button>
        )}
      </header>

      {error && <p className="error-text">{error}</p>}

      {loading ? (
        <Skeleton lines={4} />
      ) : items.length === 0 ? (
        <EmptyState title="Nothing here yet" body="Swap requests, messages and rewards will appear here." />
      ) : (
        <div className="stack">
          {items.map((item) => (
            <Card className={`card-pad notification ${item.read ? "" : "notification-unread"}`} key={item.id}>
              <div className="between">
                <div>
                  <div className="pill-row">
                    <Badge tone="accent">{item.type}</Badge>
                    {!item.read && <Badge tone="warning">new</Badge>}
                  </div>
                  <h2 className="small-heading">{item.title}</h2>
                  <p className="muted small">{item.body}</p>
                  <p className="muted small">{new Date(item.createdAt).toLocaleString()}</p>
                </div>
                <div className="stack-actions">
                  {item.link && (
                    <Link className="btn btn-ghost btn-sm" to={item.link}>
                      Open
                    </Link>
                  )}
                  {!item.read && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        await markNotificationRead(item.id);
                        await load();
                      }}
                    >
                      Mark read
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
