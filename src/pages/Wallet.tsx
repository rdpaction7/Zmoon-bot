import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../state/AuthContext";
import {
  claimAdPlaceholder,
  claimCreatorReward,
  claimDailyStreak,
  creatorRewardSummary,
  getStreak,
  listTransactions,
} from "../lib/api";
import type { CoinTransaction, Course, Streak } from "../lib/types";
import { Badge, Button, Card, EmptyState, Skeleton, Stat, useToast } from "../components/ui";
import { Icon } from "../components/icons";

const today = () => new Date().toISOString().slice(0, 10);
const daysFromToday = (back: number) =>
  new Date(Date.now() - back * 86400000).toISOString().slice(0, 10);

export default function Wallet() {
  const { user, isDemo, refreshProfile } = useAuth();
  const { push } = useToast();
  const [transactions, setTransactions] = useState<CoinTransaction[]>([]);
  const [streak, setStreak] = useState<Streak | null>(null);
  const [rewards, setRewards] = useState<{ course: Course; rewardable: number; earned: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function load() {
    if (!user) return;
    try {
      const [ledger, streakData, summary] = await Promise.all([
        listTransactions(user.id),
        getStreak(user.id),
        creatorRewardSummary(user.id).catch(() => []),
      ]);
      setTransactions(ledger);
      setStreak(streakData);
      setRewards(summary.filter((entry) => entry.rewardable > 0 || entry.earned > 0));
      setError("");
    } catch (caught: any) {
      setError(caught?.message || "Could not load your wallet.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function claim() {
    if (!user) return;
    setBusy("streak");
    try {
      const result = await claimDailyStreak(user.id);
      if (result.alreadyClaimed) {
        push("You already claimed today — come back tomorrow.", "info");
      } else {
        push(`Day ${result.streak} claimed: +${result.awarded} Skill Coins.`, "success");
      }
      await refreshProfile().catch(() => {});
      await load();
    } catch (caught: any) {
      push(caught?.message || "Could not claim your streak.", "error");
    } finally {
      setBusy("");
    }
  }

  async function claimCreator(entry: { course: Course; rewardable: number }) {
    if (!user) return;
    setBusy(`creator-${entry.course.id}`);
    try {
      const paid = await claimCreatorReward(user.id, entry.course, entry.rewardable);
      push(`Claimed ${paid} Skill Coin${paid === 1 ? "" : "s"} for "${entry.course.title}".`, "success");
      await refreshProfile().catch(() => {});
      await load();
    } catch (caught: any) {
      push(caught?.message || "Could not claim creator rewards.", "error");
    } finally {
      setBusy("");
    }
  }

  async function ad() {
    if (!user) return;
    setBusy("ad");
    try {
      const result = await claimAdPlaceholder(user.id);
      if (result.alreadyClaimed) {
        push("The placeholder reward is once per day.", "info");
      } else {
        push("Placeholder reward added — no ad provider is configured.", "info");
      }
      await refreshProfile().catch(() => {});
      await load();
    } catch (caught: any) {
      push(caught?.message || "Could not add the reward.", "error");
    } finally {
      setBusy("");
    }
  }

  if (!user) return null;
  const claimedToday = streak?.lastClaimDay === today();
  const history = streak?.history || [];

  return (
    <div className="page">
      <header className="section-head">
        <span className="eyebrow">Wallet</span>
        <h1>Skill Coins</h1>
        <p className="muted">
          Coins are only spent on paid courses. Swaps, messages and profile edits are free.
        </p>
      </header>

      {error && <p className="error-text">{error}</p>}

      {loading ? (
        <Skeleton lines={5} />
      ) : (
        <>
          <div className="grid grid-3">
            <Card className="card-pad balance-card">
              <Stat
                label="Balance"
                value={`${user.balance} coins`}
                hint="Available to spend"
                icon="coins"
              />
              <Link className="btn btn-secondary btn-sm" to="/courses">
                Browse paid courses
              </Link>
            </Card>
            <Card className="card-pad stat-card">
              <Stat
                label="Daily streak"
                value={`${streak?.current || 0} day${streak?.current === 1 ? "" : "s"}`}
                hint={`Longest: ${streak?.longest || 0} days`}
                icon="flame"
                tone="positive"
              />
              <Button
                size="sm"
                onClick={claim}
                loading={busy === "streak"}
                disabled={claimedToday || isDemo || (Boolean(busy) && busy !== "streak")}
              >
                {claimedToday ? "Claimed today" : "Claim today's coin"}
              </Button>
              <p className="muted small">+1 coin daily, +2 extra every seventh day.</p>
            </Card>
            <Card className="card-pad stat-card">
              <Stat
                label="Rewarded ad"
                value="Placeholder"
                hint="No ad provider configured"
                icon="play"
                tone="espresso"
              />
              <Button
                size="sm"
                variant="secondary"
                onClick={ad}
                loading={busy === "ad"}
                disabled={isDemo || (Boolean(busy) && busy !== "ad")}
              >
                Add placeholder reward
              </Button>
              <p className="muted small">
                This is a clearly labelled placeholder. It grants 1 demo coin once per day and does not
                represent a real, verified ad view.
              </p>
            </Card>
          </div>

          <Card className="card-pad">
            <h2>Streak calendar</h2>
            <div className="streak-days">
              {Array.from({ length: 14 }).map((_, index) => {
                const day = daysFromToday(13 - index);
                const done = history.includes(day);
                return (
                  <span
                    key={day}
                    className={`day ${done ? "day-done" : ""} ${day === today() ? "day-today" : ""}`}
                    title={day}
                  >
                    {Number(day.slice(-2))}
                  </span>
                );
              })}
            </div>
            <p className="muted small">
              Missed days reset your streak to day 1. Days use UTC so the reward is the same everywhere.
            </p>
          </Card>

          {rewards.length > 0 && (
            <Card className="card-pad">
              <div className="between">
                <h2>Creator rewards</h2>
                <Badge tone="accent">1 coin per 50 enrolments</Badge>
              </div>
              <p className="muted small">
                Claimed once per threshold. Security rules only release coins when the course
                actually crossed a 50-enrolment boundary.
              </p>
              <div className="stack">
                {rewards.map((entry) => (
                  <div className="list-row" key={entry.course.id}>
                    <div>
                      <strong className="small">{entry.course.title}</strong>
                      <p className="muted small">
                        {entry.course.enrollmentCount || 0} enrolments · {entry.earned} thresholds reached
                      </p>
                    </div>
                    {entry.rewardable > 0 ? (
                      <Button
                        size="sm"
                        onClick={() => claimCreator(entry)}
                        loading={busy === `creator-${entry.course.id}`}
                        disabled={isDemo || (Boolean(busy) && busy !== `creator-${entry.course.id}`)}
                      >
                        Claim {entry.rewardable}
                      </Button>
                    ) : (
                      <Badge tone="positive">all claimed</Badge>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card className="card-pad">
            <h2>Transaction history</h2>
            {transactions.length === 0 ? (
              <EmptyState
                icon="coins"
                title="No transactions yet"
                body="Claim your streak or buy a course to see entries here."
              />
            ) : (
              <div className="ledger">
                {transactions.map((entry) => (
                  <div className="ledger-row" key={entry.id}>
                    <div>
                      <strong className="small">{entry.reason}</strong>
                      <p className="muted small">{new Date(entry.createdAt).toLocaleString()}</p>
                    </div>
                    <div className="ledger-amount">
                      <Badge tone={entry.amount >= 0 ? "positive" : "danger"}>
                        {entry.amount >= 0 ? "+" : ""}
                        {entry.amount}
                      </Badge>
                      <span className="muted small">balance {entry.balanceAfter}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
