import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../state/AuthContext";
import { ensureConversation, listSwaps, updateSwapStatus } from "../lib/api";
import type { SwapRequest } from "../lib/types";
import { Badge, Button, Card, EmptyState, Skeleton, Tabs, useToast } from "../components/ui";

const TONE: Record<SwapRequest["status"], "neutral" | "positive" | "warning" | "danger"> = {
  pending: "warning",
  accepted: "positive",
  rejected: "danger",
  cancelled: "neutral",
  completed: "positive",
};

export default function Swaps() {
  const { user, isDemo } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const [swaps, setSwaps] = useState<SwapRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("incoming");
  const [busyId, setBusyId] = useState("");

  async function load() {
    if (!user) return;
    try {
      setSwaps(await listSwaps(user.id));
      setError("");
    } catch (caught: any) {
      setError(caught?.message || "Could not load swap requests.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function act(swap: SwapRequest, status: SwapRequest["status"]) {
    setBusyId(swap.id);
    try {
      await updateSwapStatus(swap, status);
      push(`Swap ${status}.`, "success");
      await load();
    } catch (caught: any) {
      push(caught?.message || "Could not update the swap.", "error");
    } finally {
      setBusyId("");
    }
  }

  async function openChat(swap: SwapRequest) {
    if (!user) return;
    const otherId = swap.toUserId === user.id ? swap.fromUserId : swap.toUserId;
    const otherName = swap.toUserId === user.id ? swap.fromName : swap.toName;
    setBusyId(swap.id);
    try {
      const id = await ensureConversation(user.id, otherId, user.displayName, otherName);
      navigate(`/messages?c=${encodeURIComponent(id)}`);
    } catch (caught: any) {
      push(caught?.message || "Could not open the conversation.", "error");
    } finally {
      setBusyId("");
    }
  }

  const incoming = swaps.filter((swap) => swap.toUserId === user?.id);
  const outgoing = swaps.filter((swap) => swap.fromUserId === user?.id);
  const list = tab === "incoming" ? incoming : outgoing;

  return (
    <div className="page">
      <header className="section-head">
        <span className="eyebrow">Swaps</span>
        <h1>Skill exchanges</h1>
        <p className="muted">Swaps are free — no coins change hands, ever.</p>
      </header>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "incoming", label: `Incoming (${incoming.length})` },
          { id: "outgoing", label: `Sent (${outgoing.length})` },
        ]}
      />

      {error && <p className="error-text">{error}</p>}

      {loading ? (
        <Skeleton lines={4} />
      ) : list.length === 0 ? (
        <EmptyState
          icon="swap"
          title={tab === "incoming" ? "No one has asked yet" : "You have not sent a swap"}
          body={
            tab === "incoming"
              ? "List a skill and people will start reaching out."
              : "Find a skill you want to learn and send a request."
          }
          action={
            <Link className="btn btn-primary" to="/skills">
              Discover skills
            </Link>
          }
        />
      ) : (
        <div className="grid grid-2">
          {list.map((swap) => {
            const isRecipient = swap.toUserId === user?.id;
            return (
              <Card className="card-pad" key={swap.id}>
                <div className="pill-row">
                  <Badge tone={TONE[swap.status]}>{swap.status}</Badge>
                  <Badge tone="neutral">
                    {isRecipient ? `from ${swap.fromName}` : `to ${swap.toName}`}
                  </Badge>
                </div>
                <h2>
                  {swap.offeredSkill} <span className="muted">↔</span> {swap.wantedSkill}
                </h2>
                {swap.message && <p className="muted small">{swap.message}</p>}
                <p className="muted small">
                  Created {new Date(swap.createdAt).toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>

                <div className="row wrap">
                  {swap.status === "pending" && isRecipient && (
                    <>
                      <Button size="sm" onClick={() => act(swap, "accepted")} loading={busyId === swap.id}>
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => act(swap, "rejected")}
                        loading={busyId === swap.id}
                      >
                        Decline
                      </Button>
                    </>
                  )}
                  {swap.status === "pending" && !isRecipient && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => act(swap, "cancelled")}
                      loading={busyId === swap.id}
                      disabled={isDemo}
                    >
                      Cancel request
                    </Button>
                  )}
                  {swap.status === "accepted" && (
                    <>
                      <Button size="sm" onClick={() => act(swap, "completed")} loading={busyId === swap.id}>
                        Mark complete
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => openChat(swap)}
                        loading={busyId === swap.id}
                      >
                        Message
                      </Button>
                    </>
                  )}
                  {swap.status === "completed" && (
                    <Button size="sm" variant="ghost" onClick={() => openChat(swap)} loading={busyId === swap.id}>
                      Message
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
