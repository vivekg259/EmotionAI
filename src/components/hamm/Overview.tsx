import { dayKey, formatMinutes, sessionHasCrisis } from "@/lib/hamm/analyze";
import { alertFor, buildTimeline, scoreAsOf, shareSplit } from "@/lib/hamm/score";
import { useHamm } from "@/lib/hamm/store";
import type { Band } from "@/lib/hamm/types";
import { Button, Card, formatPoints } from "@/components/hamm/ui";
import { useEffect, useMemo, useState } from "react";

const STEPS = [
  "Conversation",
  "Emotion",
  "Tracking",
  "Expression",
  "Risk",
  "Influence",
  "Explanation",
  "Alert",
];

function bandNote(band: Band) {
  if (band === "High") return "61–100 · worth a real-world pause";
  if (band === "Moderate") return "31–60 · pattern is forming";
  return "0–30 · no strong dependency signal";
}

export function Overview({
  onNavigate,
}: {
  onNavigate: (view: "conversations" | "timeline" | "expression") => void;
}) {
  const sessions = useHamm((state) => state.sessions);
  const humanLogs = useHamm((state) => state.humanLogs);
  const setHumanMinutes = useHamm((state) => state.setHumanMinutes);
  const loadSample = useHamm((state) => state.loadSample);
  const sampleOn = sessions.some((session) => session.sample);
  const today = dayKey(Date.now());
  const savedHuman = humanLogs.find((log) => log.date === today)?.minutes ?? 0;
  const [humanDraft, setHumanDraft] = useState(savedHuman ? String(savedHuman) : "");
  const [confirmSample, setConfirmSample] = useState(false);

  useEffect(() => {
    setHumanDraft(savedHuman ? String(savedHuman) : "");
  }, [savedHuman]);

  const report = useMemo(
    () => scoreAsOf(sessions, humanLogs),
    [sessions, humanLogs],
  );
  const timeline = useMemo(
    () => buildTimeline(sessions, humanLogs),
    [sessions, humanLogs],
  );
  const alert = alertFor(report, timeline);
  const split = shareSplit(report.aiMinutes, report.humanMinutes);
  const crisis = sessions.some(sessionHasCrisis);

  const onSample = () => {
    const hasOwn = sessions.some((session) => !session.sample);
    if (hasOwn && !confirmSample) {
      setConfirmSample(true);
      return;
    }
    loadSample();
    setConfirmSample(false);
  };

  return (
    <div className="grid gap-5">
      <Card className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="font-display text-2xl text-fg">Webcam face expression</h2>
          <p className="mt-1 text-sm text-muted">
            Open the camera or upload a photo. EmotionAI compares that expression with the emotion in your
            latest message. The image stays on this device.
          </p>
        </div>
        <Button className="w-full shrink-0 sm:w-auto" onClick={() => onNavigate("expression")}>
          Open face check
        </Button>
      </Card>

      {sessions.length === 0 ? (
        <Card>
          <h2 className="font-display text-3xl text-fg">No conversations yet</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Add a transcript, or load the sample study. The sample is labeled fiction so a rising score
            can be inspected before any personal text is entered.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button onClick={() => onNavigate("conversations")}>Add a conversation</Button>
            <Button variant="ghost" onClick={onSample}>
              {confirmSample ? "Replace my data with the sample" : "Load sample study"}
            </Button>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-5 md:grid-cols-[16rem_minmax(0,1fr)]">
        <Card className="flex flex-col items-start">
          <p className="text-sm text-muted">Dependency-risk score</p>
          <ScoreRing score={report.total} />
          <p className="font-display text-3xl text-fg">{report.band}</p>
          <p className="mt-1 text-sm text-muted">{bandNote(report.band)}</p>
          <p className="mt-4 text-sm text-muted">
            Last 7 days · {report.sessions} session{report.sessions === 1 ? "" : "s"} ·{" "}
            {formatMinutes(report.aiMinutes)} with AI
          </p>
          <p className="mt-3 text-xs text-muted">Not a medical diagnosis.</p>
        </Card>

        <Card>
          <div className="flex min-w-0 items-baseline justify-between gap-3">
            <h2 className="font-display text-2xl text-fg">Why this score</h2>
            <p className="font-display text-2xl tabular-nums text-fg">
              {String(report.total).padStart(2, "0")}
              <span className="text-base text-muted">/100</span>
            </p>
          </div>
          <ul className="mt-2">
            {report.factors.map((factor) => (
              <li
                key={factor.key}
                className="grid grid-cols-[1fr_auto] gap-4 border-b border-border py-3 last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-fg">{factor.label}</p>
                  <p className="text-sm text-muted">{factor.reason}</p>
                </div>
                <p className="text-right font-display text-xl tabular-nums text-primary">
                  {formatPoints(factor.points)}
                  <span className="ml-1 text-xs text-muted">/{factor.max}</span>
                </p>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card
        className={
          alert.level === "none" ? "" : "border-primary"
        }
      >
        <p className="text-xs font-medium tracking-wide text-primary">
          {alert.level === "high" ? "Alert" : alert.level === "watch" ? "Watch" : "Status"}
        </p>
        <h2 className="mt-1 font-display text-2xl text-fg">{alert.title}</h2>
        <p className="mt-2 max-w-3xl text-sm text-muted">{alert.body}</p>
        <ul className="mt-4 grid gap-2 md:grid-cols-3">
          {alert.suggestions.map((item) => (
            <li key={item} className="rounded-xl bg-bg px-3 py-3 text-sm text-fg">
              {item}
            </li>
          ))}
        </ul>
        {crisis ? (
          <p className="mt-4 text-sm text-fg">
            Some text matches a distress phrase. If that is urgent, use the resources at the top of the
            page — this score is not a response to a crisis.
          </p>
        ) : null}
      </Card>

      <div className="grid gap-5 md:grid-cols-2">
        <Card>
          <h2 className="font-display text-2xl text-fg">AI vs human time</h2>
          <p className="mt-1 text-sm text-muted">
            AI time comes from sessions. Human time is whatever you choose to log. Missing human time is
            not treated as zero life — that factor stays out until you log it.
          </p>
          {split.known ? (
            <>
              <div className="mt-5 flex h-3 overflow-hidden rounded-full bg-surface-2">
                <div className="bg-primary" style={{ width: `${split.ai}%` }} />
                <div className="bg-fg" style={{ width: `${split.human}%` }} />
              </div>
              <div className="mt-3 flex justify-between text-sm">
                <span className="text-primary">AI {split.ai}%</span>
                <span className="text-fg">Human {split.human}%</span>
              </div>
              <p className="mt-2 text-sm text-muted">
                {formatMinutes(report.aiMinutes)} AI · {formatMinutes(report.humanMinutes)} human, last 7
                days
              </p>
            </>
          ) : (
            <p className="mt-4 text-sm text-fg">Log human time below to draw the comparison.</p>
          )}
        </Card>

        <Card>
          <h2 className="font-display text-2xl text-fg">Time with people today</h2>
          <p className="mt-1 text-sm text-muted">
            Minutes you actually spent with another person. This is voluntary and stays on this device.
          </p>
          <form
            className="mt-4 flex flex-wrap items-center gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              const value = Number(humanDraft);
              if (!Number.isFinite(value) || value < 0) return;
              setHumanMinutes(today, value);
            }}
          >
            <label className="sr-only" htmlFor="human-minutes">
              Minutes with people today
            </label>
            <input
              id="human-minutes"
              inputMode="numeric"
              min={0}
              max={1440}
              value={humanDraft}
              onChange={(event) => setHumanDraft(event.target.value)}
              placeholder="0"
              className="h-11 w-28 rounded-xl border border-border bg-bg px-3 tabular-nums"
            />
            <span className="text-sm text-muted">minutes</span>
            <Button type="submit" variant="ink">
              Save today
            </Button>
          </form>
          <div className="mt-4 flex flex-wrap gap-2">
            {[15, 30, 60, 120].map((value) => (
              <Button
                key={value}
                variant="ghost"
                onClick={() => {
                  setHumanDraft(String(value));
                  setHumanMinutes(today, value);
                }}
              >
                {value} min
              </Button>
            ))}
          </div>
          {savedHuman > 0 ? (
            <p className="mt-3 text-sm text-muted">Saved for today: {savedHuman} min.</p>
          ) : null}
        </Card>
      </div>

      <Card>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl text-fg">How a reading is made</h2>
            <p className="mt-1 text-sm text-muted">
              Same path as the project brief. Expression is optional and never required for the score.
            </p>
          </div>
          <Button variant="ghost" onClick={() => onNavigate("timeline")}>
            Open timeline
          </Button>
        </div>
        <ol className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {STEPS.map((step, index) => (
            <li
              key={step}
              className="flex shrink-0 items-center gap-2 rounded-full bg-bg px-3 py-2 text-sm text-fg"
            >
              <span className="tabular-nums text-muted">{index + 1}</span>
              {step}
            </li>
          ))}
        </ol>
        {sampleOn ? (
          <p className="mt-4 text-sm text-muted">
            Sample study is loaded. Adding your own conversation replaces it.
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-3">
          <Button variant="ghost" onClick={() => onNavigate("expression")}>
            Check expression
          </Button>
          {sessions.length > 0 ? (
            <Button variant="quiet" onClick={onSample}>
              {confirmSample ? "Confirm replace with sample" : "Reload sample study"}
            </Button>
          ) : null}
        </div>
      </Card>
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.max(0, Math.min(100, score)) / 100) * circumference;
  return (
    <div className="relative my-4 size-36">
      <svg viewBox="0 0 140 140" className="size-full -rotate-90" aria-hidden="true">
        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          strokeWidth="10"
          className="text-surface-2"
          stroke="currentColor"
        />
        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          className="text-primary"
          stroke="currentColor"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-5xl tabular-nums text-fg">{score}</span>
        <span className="text-xs text-muted">/ 100</span>
      </div>
    </div>
  );
}
