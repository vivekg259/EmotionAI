export type Role = "user" | "ai";

export type Sentiment = "positive" | "negative" | "neutral";

export type EmotionName =
  | "loneliness"
  | "sadness"
  | "anxiety"
  | "anger"
  | "happiness"
  | "neutral";

export type FaceExpression =
  | "happy"
  | "sad"
  | "angry"
  | "anxious"
  | "fear"
  | "surprised"
  | "disgust"
  | "contempt"
  | "neutral";

export type FactorKey =
  | "frequency"
  | "duration"
  | "intensity"
  | "reassurance"
  | "disclosure"
  | "imbalance"
  | "influence";

export type Band = "Low" | "Moderate" | "High";

export type Turn = {
  id: string;
  role: Role;
  text: string;
  at: number;
};

export type Session = {
  id: string;
  startedAt: number;
  endedAt: number;
  durationMs: number;
  durationSource: "measured" | "estimated";
  turns: Turn[];
  sample?: boolean;
};

export type HumanLog = {
  date: string;
  minutes: number;
};

export type FaceSample = {
  id: string;
  at: number;
  expression: FaceExpression;
  confidence: number;
  textEmotion: EmotionName;
  mismatch: boolean;
};

export type Factor = {
  key: FactorKey;
  label: string;
  points: number;
  max: number;
  reason: string;
};

export type ScoreReport = {
  total: number;
  band: Band;
  factors: Factor[];
  aiMinutes: number;
  humanMinutes: number;
  sessions: number;
  userTurns: number;
  flaggedReplies: number;
  asOf: number;
};

export type DayPoint = {
  date: string;
  label: string;
  score: number;
  band: Band;
  aiMinutes: number;
  humanMinutes: number;
  sessions: number;
};

export type TurnReading = {
  sentiment: Sentiment;
  primaryEmotion: EmotionName;
  emotions: { name: Exclude<EmotionName, "neutral">; weight: number }[];
  intensity: number;
  disclosure: boolean;
  reassurance: boolean;
  influenceFlags: string[];
  crisis: boolean;
};
