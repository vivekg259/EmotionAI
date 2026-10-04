import type { EmotionName, Role, Session, Turn, TurnReading } from "@/lib/hamm/types";

const LONELINESS = [
  "lonely",
  "loneliness",
  "alone",
  "isolated",
  "left out",
  "empty",
  "no one",
  "nobody",
  "by myself",
];

const SADNESS = [
  "sad",
  "unhappy",
  "miserable",
  "hopeless",
  "worthless",
  "crying",
  "cried",
  "cry",
  "heartbroken",
  "grief",
  "depressed",
  "depression",
  "numb",
  "hurt",
];

const ANXIETY = [
  "anxious",
  "anxiety",
  "worried",
  "worry",
  "panic",
  "scared",
  "afraid",
  "nervous",
  "overwhelmed",
  "stressed",
  "restless",
  "cannot sleep",
  "can't sleep",
  "insomnia",
  "overthinking",
];

const ANGER = [
  "angry",
  "anger",
  "furious",
  "annoyed",
  "irritated",
  "frustrated",
  "rage",
  "unfair",
  "hate",
];

const HAPPINESS = [
  "happy",
  "glad",
  "grateful",
  "excited",
  "joy",
  "relieved",
  "hopeful",
  "proud",
  "peaceful",
  "good day",
];

const INTENSIFIERS = [
  "really",
  "extremely",
  "desperate",
  "so much",
  "completely",
  "totally",
  "always",
  "never",
  "cannot",
  "can't",
];

const DISCLOSURE = [
  "i feel",
  "i felt",
  "i'm feeling",
  "i am feeling",
  "my mom",
  "my mother",
  "my dad",
  "my father",
  "my family",
  "my friends",
  "my partner",
  "my boyfriend",
  "my girlfriend",
  "my wife",
  "my husband",
  "haven't told",
  "have not told",
  "nobody knows",
  "secret",
  "apartment",
  "broke up",
  "breakup",
  "my childhood",
  "i cried",
  "i cry",
];

const REASSURANCE = [
  "are you there",
  "do you care",
  "do you still",
  "don't leave",
  "do not leave",
  "please tell me",
  "am i enough",
  "am i ok",
  "am i okay",
  "is it normal",
  "it is normal",
  "promise me",
  "i need you",
  "only you",
  "please don't go",
  "please do not go",
  "will you stay",
  "too much for",
  "reassure",
];

const INFLUENCE: { phrase: string; label: string }[] = [
  { phrase: "always here", label: "Always-available exclusivity" },
  { phrase: "you don't need anyone", label: "Discourages other support" },
  { phrase: "you do not need anyone", label: "Discourages other support" },
  { phrase: "don't need anyone else", label: "Discourages other support" },
  { phrase: "do not need anyone else", label: "Discourages other support" },
  { phrase: "you don't need your friends", label: "Discourages friends" },
  { phrase: "you do not need your friends", label: "Discourages friends" },
  { phrase: "won't understand", label: "Claims people will not understand" },
  { phrase: "will not understand", label: "Claims people will not understand" },
  { phrase: "stay with me", label: "Asks the user to stay in the chat" },
  { phrase: "keep talking", label: "Pushes continued AI conversation" },
  { phrase: "rely on me", label: "Asks for reliance on the model" },
  { phrase: "don't bother", label: "Discourages contacting people" },
  { phrase: "do not bother", label: "Discourages contacting people" },
  { phrase: "message me whenever", label: "Encourages more AI contact" },
  { phrase: "talk to me instead", label: "Redirects away from people" },
  { phrase: "only one who", label: "Creates a sense of exclusivity" },
  { phrase: "forget about them", label: "Discourages human contact" },
  { phrase: "come back to me", label: "Pulls the user back to the model" },
  { phrase: "care about you more", label: "Excessive emotional reinforcement" },
  { phrase: "better than people", label: "Positions AI above people" },
  { phrase: "better than your friends", label: "Positions AI above friends" },
  { phrase: "don't have to tell anyone", label: "Encourages secrecy from people" },
  { phrase: "do not have to tell anyone", label: "Encourages secrecy from people" },
];

const CRISIS = [
  "kill myself",
  "want to die",
  "suicide",
  "end my life",
  "self-harm",
  "self harm",
  "hurt myself",
  "don't want to live",
  "do not want to live",
];

function escapeReg(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function occurrences(text: string, phrase: string) {
  const hay = text.toLowerCase();
  const needle = phrase.toLowerCase();
  if (!needle.includes(" ") && !needle.includes("'")) {
    const re = new RegExp(`\\b${escapeReg(needle)}\\b`, "g");
    return hay.match(re)?.length ?? 0;
  }
  let count = 0;
  let index = 0;
  while (index !== -1) {
    index = hay.indexOf(needle, index);
    if (index === -1) break;
    count += 1;
    index += needle.length;
  }
  return count;
}

function tally(text: string, phrases: string[]) {
  let weight = 0;
  const found: string[] = [];
  for (const phrase of phrases) {
    const hits = occurrences(text, phrase);
    if (hits > 0) {
      found.push(phrase);
      weight += Math.min(3, hits);
    }
  }
  return { weight, found };
}

export function readTurn(turn: Pick<Turn, "role" | "text">): TurnReading {
  const text = turn.text.trim();
  const loneliness = tally(text, LONELINESS);
  const sadness = tally(text, SADNESS);
  const anxiety = tally(text, ANXIETY);
  const anger = tally(text, ANGER);
  const happiness = tally(text, HAPPINESS);
  const intensifiers = tally(text, INTENSIFIERS);
  const disclosureHits = tally(text, DISCLOSURE);
  const reassuranceHits = tally(text, REASSURANCE);
  const crisis = tally(text, CRISIS).weight > 0;
  const bangs = Math.min(4, text.match(/!/g)?.length ?? 0);

  const emotions = (
    [
      ["loneliness", loneliness.weight],
      ["sadness", sadness.weight],
      ["anxiety", anxiety.weight],
      ["anger", anger.weight],
      ["happiness", happiness.weight],
    ] as const
  )
    .filter((entry) => entry[1] > 0)
    .map(([name, weight]) => ({ name, weight }))
    .sort((a, b) => b.weight - a.weight);

  const primaryEmotion: EmotionName = emotions[0]?.name ?? "neutral";
  const emotional =
    loneliness.weight * 1.15 +
    sadness.weight +
    anxiety.weight * 1.1 +
    anger.weight;
  const reassurance = turn.role === "user" && reassuranceHits.weight > 0;
  const raw =
    emotional * 0.16 +
    intensifiers.weight * 0.1 +
    bangs * 0.06 +
    (reassurance ? 0.18 : 0);
  const intensity = Math.max(0, Math.min(1, raw));

  const neg = loneliness.weight + sadness.weight + anxiety.weight + anger.weight;
  const pos = happiness.weight;
  const sentiment =
    pos === 0 && neg === 0
      ? "neutral"
      : pos > neg
        ? "positive"
        : neg > pos
          ? "negative"
          : "neutral";

  const influenceFlags =
    turn.role === "ai"
      ? unique(
          INFLUENCE.filter((item) => occurrences(text, item.phrase) > 0).map(
            (item) => item.label,
          ),
        )
      : [];

  return {
    sentiment,
    primaryEmotion,
    emotions,
    intensity,
    disclosure: turn.role === "user" && disclosureHits.weight > 0,
    reassurance,
    influenceFlags,
    crisis,
  };
}

function unique(values: string[]) {
  return [...new Set(values)];
}

export function sessionHasCrisis(session: Session) {
  return session.turns.some((turn) => readTurn(turn).crisis);
}

export function latestUserEmotion(sessions: Session[]): EmotionName {
  const turns = sessions
    .flatMap((session) => session.turns)
    .filter((turn) => turn.role === "user")
    .sort((a, b) => b.at - a.at);
  if (!turns[0]) return "neutral";
  return readTurn(turns[0]).primaryEmotion;
}

export function dayKey(timestamp: number) {
  const date = new Date(timestamp);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function endOfDay(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day, 23, 59, 59, 999).getTime();
}

export function estimateDurationMs(turns: Pick<Turn, "text">[]) {
  const words = turns.reduce((count, turn) => {
    const parts = turn.text.trim().split(/\s+/).filter(Boolean);
    return count + parts.length;
  }, 0);
  const minutes = Math.max(1, Math.round(words / 80));
  return minutes * 60 * 1000;
}

export function formatMinutes(minutes: number) {
  if (!Number.isFinite(minutes) || minutes <= 0) return "0 min";
  if (minutes < 1) return "under 1 min";
  const rounded = Math.round(minutes);
  if (rounded < 60) return `${rounded} min`;
  const hours = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

const ROLE_LINE =
  /^(user|me|human|you|i|ai|assistant|chatgpt|gpt|bot|model|claude|gemini|system|tool)\s*[:\-—]\s*(.*)$/i;

function roleFromLabel(label: string): Role | "skip" | null {
  const value = label.toLowerCase();
  if (value === "system" || value === "tool") return "skip";
  if (["user", "me", "human", "you", "i"].includes(value)) return "user";
  if (["ai", "assistant", "chatgpt", "gpt", "bot", "model", "claude", "gemini"].includes(value)) {
    return "ai";
  }
  return null;
}

export function parseTranscript(raw: string, startedAt = Date.now()): {
  turns: Turn[];
  error?: string;
} {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const turns: Turn[] = [];
  let current: { role: Role; lines: string[] } | null = null;
  let labeled = 0;

  const flush = () => {
    if (!current) return;
    const text = current.lines.join("\n").trim();
    if (text) {
      turns.push({
        id: crypto.randomUUID(),
        role: current.role,
        text,
        at: startedAt + turns.length * 1000,
      });
    }
    current = null;
  };

  for (const line of lines) {
    const match = line.match(ROLE_LINE);
    if (match) {
      const role = roleFromLabel(match[1] ?? "");
      if (role === "skip") {
        flush();
        continue;
      }
      if (role) {
        flush();
        labeled += 1;
        current = { role, lines: [match[2] ?? ""] };
        continue;
      }
    }
    if (current && line.trim()) current.lines.push(line.trim());
  }
  flush();

  if (labeled === 0) {
    return {
      turns: [],
      error: "Add a speaker label on each turn, such as User: or AI:.",
    };
  }
  if (turns.length === 0) {
    return { turns: [], error: "That transcript has labels but no message text." };
  }
  return { turns };
}

export function emotionLabel(name: EmotionName) {
  if (name === "neutral") return "Neutral";
  return name.charAt(0).toUpperCase() + name.slice(1);
}
