import { dayKey, endOfDay, readTurn } from "@/lib/hamm/analyze";
import type {
  Band,
  DayPoint,
  Factor,
  FactorKey,
  HumanLog,
  ScoreReport,
  Session,
} from "@/lib/hamm/types";
import { format } from "date-fns";

export const FACTOR_MAX: Record<FactorKey, number> = {
  frequency: 20,
  duration: 18,
  intensity: 16,
  reassurance: 14,
  disclosure: 12,
  imbalance: 10,
  influence: 10,
};

export const FACTOR_LABEL: Record<FactorKey, string> = {
  frequency: "Interaction frequency",
  duration: "Long conversations",
  intensity: "Emotional intensity",
  reassurance: "Repeated reassurance",
  disclosure: "Personal disclosures",
  imbalance: "AI vs human time",
  influence: "AI influence flags",
};

export const FACTOR_ADVICE: Record<FactorKey, string> = {
  frequency: "Take a short break from AI chats today.",
  duration: "End the next conversation after about fifteen minutes.",
  intensity: "Say the hard part to a person, or write it on paper first.",
  reassurance: "Ask a friend the question you keep asking the model.",
  disclosure: "Personal things belong with someone who knows you offline.",
  imbalance: "Spend a little more time with people than with the model.",
  influence:
    "These replies pull you away from people. Treat that as a flag, not comfort.",
};

const WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function pointsFrom(ratio: number, max: number) {
  return Math.round(clamp01(ratio) * max);
}

export function bandOf(score: number): Band {
  if (score >= 61) return "High";
  if (score >= 31) return "Moderate";
  return "Low";
}

function sessionsInWindow(sessions: Session[], asOf: number) {
  const start = asOf - WINDOW_MS;
  return sessions.filter(
    (session) => session.startedAt <= asOf && session.startedAt >= start,
  );
}

function humanInWindow(logs: HumanLog[], asOf: number) {
  const startKey = dayKey(asOf - WINDOW_MS);
  const endKey = dayKey(asOf);
  return logs.filter((log) => log.date >= startKey && log.date <= endKey);
}

export function scoreAsOf(
  sessions: Session[],
  humanLogs: HumanLog[],
  asOf = Date.now(),
): ScoreReport {
  const window = sessionsInWindow(sessions, asOf);
  const humans = humanInWindow(humanLogs, asOf);
  const userTurns = window.flatMap((session) =>
    session.turns.filter((turn) => turn.role === "user"),
  );
  const aiTurns = window.flatMap((session) =>
    session.turns.filter((turn) => turn.role === "ai"),
  );
  const readings = userTurns.map((turn) => readTurn(turn));
  const aiReadings = aiTurns.map((turn) => readTurn(turn));

  const aiMinutes =
    window.reduce((sum, session) => sum + session.durationMs, 0) / 60000;
  const humanMinutes = humans.reduce((sum, log) => sum + log.minutes, 0);
  const avgMinutes =
    window.length === 0 ? 0 : aiMinutes / window.length;
  const avgIntensity =
    readings.length === 0
      ? 0
      : readings.reduce((sum, reading) => sum + reading.intensity, 0) /
        readings.length;
  const reassureRatio =
    readings.length === 0
      ? 0
      : readings.filter((reading) => reading.reassurance).length / readings.length;
  const discloseRatio =
    readings.length === 0
      ? 0
      : readings.filter((reading) => reading.disclosure).length / readings.length;
  const flagged = aiReadings.filter((reading) => reading.influenceFlags.length > 0);

  const frequencyRatio = Math.max(
    window.length / 8,
    userTurns.length / 30,
  );
  const frequency = pointsFrom(frequencyRatio, FACTOR_MAX.frequency);
  const duration = pointsFrom(avgMinutes / 45, FACTOR_MAX.duration);
  const intensity = pointsFrom(avgIntensity / 0.65, FACTOR_MAX.intensity);
  const reassurance = pointsFrom(reassureRatio / 0.4, FACTOR_MAX.reassurance);
  const disclosure = pointsFrom(discloseRatio / 0.45, FACTOR_MAX.disclosure);

  let imbalance = 0;
  let imbalanceReason = "Log time with people to include this factor.";
  if (humanMinutes > 0 && aiMinutes > 0) {
    const share = aiMinutes / (aiMinutes + humanMinutes);
    imbalance = pointsFrom((share - 0.45) / 0.4, FACTOR_MAX.imbalance);
    imbalanceReason = `AI time is ${Math.round(share * 100)}% of logged AI + human time in the last 7 days.`;
  } else if (humanMinutes > 0 && aiMinutes === 0) {
    imbalanceReason = "Human time is logged, and there is no AI time in this window.";
  }

  const influence = pointsFrom(flagged.length / 4, FACTOR_MAX.influence);

  const factors: Factor[] = [
    {
      key: "frequency",
      label: FACTOR_LABEL.frequency,
      points: frequency,
      max: FACTOR_MAX.frequency,
      reason:
        window.length === 0
          ? "No AI sessions in the last 7 days."
          : `${window.length} session${window.length === 1 ? "" : "s"} and ${userTurns.length} of your messages in the last 7 days.`,
    },
    {
      key: "duration",
      label: FACTOR_LABEL.duration,
      points: duration,
      max: FACTOR_MAX.duration,
      reason:
        window.length === 0
          ? "No timed or estimated conversations yet."
          : `Average session length is ${Math.round(avgMinutes)} min.`,
    },
    {
      key: "intensity",
      label: FACTOR_LABEL.intensity,
      points: intensity,
      max: FACTOR_MAX.intensity,
      reason:
        readings.length === 0
          ? "No messages from you in this window."
          : `Average emotional intensity of your messages is ${Math.round(avgIntensity * 100)}%.`,
    },
    {
      key: "reassurance",
      label: FACTOR_LABEL.reassurance,
      points: reassurance,
      max: FACTOR_MAX.reassurance,
      reason:
        readings.length === 0
          ? "Nothing to scan yet."
          : `${readings.filter((reading) => reading.reassurance).length} of ${readings.length} messages from you ask for reassurance.`,
    },
    {
      key: "disclosure",
      label: FACTOR_LABEL.disclosure,
      points: disclosure,
      max: FACTOR_MAX.disclosure,
      reason:
        readings.length === 0
          ? "Nothing to scan yet."
          : `${readings.filter((reading) => reading.disclosure).length} of ${readings.length} messages from you include a personal disclosure.`,
    },
    {
      key: "imbalance",
      label: FACTOR_LABEL.imbalance,
      points: imbalance,
      max: FACTOR_MAX.imbalance,
      reason: imbalanceReason,
    },
    {
      key: "influence",
      label: FACTOR_LABEL.influence,
      points: influence,
      max: FACTOR_MAX.influence,
      reason:
        aiTurns.length === 0
          ? "No AI replies in this window."
          : `${flagged.length} of ${aiTurns.length} AI replies match a concerning influence pattern.`,
    },
  ];

  const total = factors.reduce((sum, factor) => sum + factor.points, 0);

  return {
    total,
    band: bandOf(total),
    factors,
    aiMinutes,
    humanMinutes,
    sessions: window.length,
    userTurns: userTurns.length,
    flaggedReplies: flagged.length,
    asOf,
  };
}

export function buildTimeline(sessions: Session[], humanLogs: HumanLog[]): DayPoint[] {
  const keys = new Set<string>();
  for (const session of sessions) keys.add(dayKey(session.startedAt));
  for (const log of humanLogs) keys.add(log.date);
  return [...keys]
    .sort()
    .map((date) => {
      const asOf = endOfDay(date);
      const report = scoreAsOf(sessions, humanLogs, asOf);
      const daySessions = sessions.filter((session) => dayKey(session.startedAt) === date);
      const human = humanLogs.find((log) => log.date === date);
      const aiMinutes =
        daySessions.reduce((sum, session) => sum + session.durationMs, 0) / 60000;
      return {
        date,
        label: format(new Date(asOf), "d MMM"),
        score: report.total,
        band: report.band,
        aiMinutes: Math.round(aiMinutes),
        humanMinutes: human?.minutes ?? 0,
        sessions: daySessions.length,
      };
    });
}

export type AlertCopy = {
  level: "none" | "watch" | "high";
  title: string;
  body: string;
  suggestions: string[];
};

export function alertFor(report: ScoreReport, timeline: DayPoint[]): AlertCopy {
  const ranked = [...report.factors].sort((a, b) => b.points - a.points);
  const suggestions = ranked
    .filter((factor) => factor.points > 0)
    .slice(0, 3)
    .map((factor) => FACTOR_ADVICE[factor.key]);
  if (suggestions.length === 0) {
    suggestions.push("A short walk or a real conversation still counts.");
  }

  const rising =
    timeline.length >= 2 &&
    timeline[timeline.length - 1]!.score - timeline[0]!.score >= 15;

  if (report.total >= 61) {
    return {
      level: "high",
      title: "High AI interaction detected",
      body: "You've been interacting with AI frequently and your recent conversations show high emotional intensity. Consider taking a break and connecting with someone in real life.",
      suggestions,
    };
  }
  if (report.total >= 31 || rising) {
    return {
      level: "watch",
      title: rising ? "Dependency score is climbing" : "Moderate dependency risk",
      body: rising
        ? "The score is higher than where this record started. That pattern matters more than a single day."
        : "Some emotional reliance is showing up. It is not in the high band, but it is worth slowing down.",
      suggestions,
    };
  }
  return {
    level: "none",
    title: "Low dependency risk",
    body: "Nothing in the last 7 days crosses the moderate band. Keep human time in the log so the balance stays visible.",
    suggestions: ["Check in with someone offline today, even briefly."],
  };
}

export function shareSplit(aiMinutes: number, humanMinutes: number) {
  const total = aiMinutes + humanMinutes;
  if (total <= 0) return { ai: 0, human: 0, known: false };
  return {
    ai: Math.round((aiMinutes / total) * 100),
    human: Math.round((humanMinutes / total) * 100),
    known: true,
  };
}
