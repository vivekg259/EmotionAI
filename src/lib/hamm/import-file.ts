import { estimateDurationMs, parseTranscript } from "@/lib/hamm/analyze";
import type { Role, Session, Turn } from "@/lib/hamm/types";

const MAX_BYTES = 15 * 1024 * 1024;
const MAX_SESSIONS = 15;
const MAX_TURNS = 200;

export type ImportResult = {
  sessions: Session[];
  error?: string;
  notice?: string;
};

type Draft = {
  startedAt: number;
  turns: { role: Role; text: string; at: number }[];
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function roleOf(value: unknown): Role | null {
  if (typeof value !== "string") return null;
  const label = value.toLowerCase();
  if (label === "user" || label === "human" || label === "me") return "user";
  if (
    label === "assistant" ||
    label === "ai" ||
    label === "bot" ||
    label === "model" ||
    label === "chatgpt" ||
    label === "gpt" ||
    label === "claude" ||
    label === "gemini"
  ) {
    return "ai";
  }
  return null;
}

function textOf(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value
      .map((part) => {
        if (typeof part === "string") return part;
        const record = asRecord(part);
        if (record && typeof record.text === "string") return record.text;
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }
  const record = asRecord(value);
  if (!record) return "";
  if (typeof record.content === "string" || Array.isArray(record.content)) return textOf(record.content);
  if (typeof record.text === "string") return record.text;
  if (typeof record.message === "string") return record.message;
  if (typeof record.value === "string") return record.value;
  if (record.parts) return textOf(record.parts);
  return "";
}

function timeOf(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value < 1e12 ? value * 1000 : value;
  }
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return fallback;
}

function fromMessages(list: unknown[], fallback: number): Draft | null {
  const turns: Draft["turns"] = [];
  list.forEach((item, index) => {
    const record = asRecord(item);
    if (!record) return;
    const author = asRecord(record.author);
    const role = roleOf(record.role ?? record.sender ?? record.from ?? author?.role);
    const text = textOf(record.content ?? record.text ?? record.message ?? record).trim();
    if (!role || !text) return;
    turns.push({
      role,
      text,
      at: timeOf(record.create_time ?? record.timestamp ?? record.created_at ?? record.at, fallback + index * 1000),
    });
  });
  if (turns.length === 0) return null;
  const clipped = turns.slice(-MAX_TURNS);
  return { startedAt: clipped[0]?.at ?? fallback, turns: clipped };
}

function fromChatGpt(conv: Record<string, unknown>, fallback: number): Draft | null {
  const mapping = asRecord(conv.mapping);
  if (!mapping) return null;
  const nodes = Object.values(mapping)
    .map((node) => asRecord(node))
    .filter((node): node is Record<string, unknown> => node !== null);
  let current: Record<string, unknown> | undefined =
    nodes.find((node) => node.parent == null) ?? nodes[0];
  const turns: Draft["turns"] = [];
  const seen = new Set<string>();
  let guard = 0;
  while (current && guard < 5000) {
    guard += 1;
    const id = String(current.id ?? guard);
    if (seen.has(id)) break;
    seen.add(id);
    const message = asRecord(current.message);
    if (message) {
      const author = asRecord(message.author);
      const role = roleOf(author?.role);
      const content = asRecord(message.content);
      const text = textOf(content?.parts ?? message.content).trim();
      if (role && text) {
        turns.push({
          role,
          text,
          at: timeOf(message.create_time, fallback + turns.length * 1000),
        });
      }
    }
    const childIds: unknown[] = Array.isArray(current.children) ? current.children : [];
    const nextId = childIds.length > 0 ? String(childIds[childIds.length - 1]) : "";
    current = nextId ? asRecord(mapping[nextId]) ?? undefined : undefined;
  }
  if (turns.length === 0) return null;
  const clipped = turns.slice(-MAX_TURNS);
  return { startedAt: clipped[0]?.at ?? fallback, turns: clipped };
}

function looksLikeThread(value: Record<string, unknown>) {
  return (
    value.mapping != null ||
    Array.isArray(value.messages) ||
    Array.isArray(value.turns) ||
    Array.isArray(value.conversation) ||
    Array.isArray(value.conversations)
  );
}

export function parseConversationData(data: unknown, fallback = Date.now()): {
  drafts: Draft[];
  truncated: boolean;
} {
  const drafts: Draft[] = [];

  const collect = (value: unknown) => {
    if (Array.isArray(value)) {
      const records = value.map((item) => asRecord(item)).filter((item): item is Record<string, unknown> => item !== null);
      if (records.length > 0 && records.every((item) => looksLikeThread(item) || item.mapping != null)) {
        records.forEach((item) => collect(item));
        return;
      }
      const draft = fromMessages(value, fallback);
      if (draft) drafts.push(draft);
      return;
    }
    const record = asRecord(value);
    if (!record) return;
    if (record.mapping) {
      const draft = fromChatGpt(record, fallback);
      if (draft) drafts.push(draft);
      return;
    }
    if (Array.isArray(record.conversations)) {
      record.conversations.forEach((item) => collect(item));
      return;
    }
    if (Array.isArray(record.messages)) {
      collect(record.messages);
      return;
    }
    if (Array.isArray(record.turns) || Array.isArray(record.conversation)) {
      collect(record.turns ?? record.conversation);
      return;
    }
    if (typeof record.transcript === "string") {
      const parsed = parseTranscript(record.transcript, fallback);
      if (!parsed.error && parsed.turns.length > 0) {
        drafts.push({
          startedAt: parsed.turns[0]?.at ?? fallback,
          turns: parsed.turns.map((turn) => ({ role: turn.role, text: turn.text, at: turn.at })),
        });
      }
    }
  };

  collect(data);
  const usable = drafts.filter((draft) => draft.turns.length > 0);
  usable.sort((a, b) => a.startedAt - b.startedAt);
  const truncated = usable.length > MAX_SESSIONS;
  return { drafts: usable.slice(-MAX_SESSIONS), truncated };
}

function toSession(draft: Draft): Session {
  const startedAt = draft.startedAt;
  const turns: Turn[] = draft.turns.map((turn, index) => ({
    id: crypto.randomUUID(),
    role: turn.role,
    text: turn.text,
    at: turn.at || startedAt + index * 1000,
  }));
  const endedAt = turns.reduce((max, turn) => Math.max(max, turn.at), startedAt);
  return {
    id: crypto.randomUUID(),
    startedAt,
    endedAt,
    durationMs: estimateDurationMs(turns),
    durationSource: "estimated",
    turns,
  };
}

export async function importConversationFile(file: File): Promise<ImportResult> {
  if (file.size > MAX_BYTES) {
    return {
      sessions: [],
      error: "That file is over 15 MB. Upload one chat, or a smaller JSON or text export.",
    };
  }
  const raw = await file.text();
  const trimmed = raw.trim();
  const jsonLike =
    file.name.toLowerCase().endsWith(".json") || trimmed.startsWith("{") || trimmed.startsWith("[");

  if (jsonLike) {
    try {
      const data: unknown = JSON.parse(trimmed);
      const parsed = parseConversationData(data);
      if (parsed.drafts.length === 0) {
        return { sessions: [], error: "No user or AI messages were found in that JSON." };
      }
      const sessions = parsed.drafts.map(toSession);
      const turns = sessions.reduce((sum, session) => sum + session.turns.length, 0);
      return {
        sessions,
        notice: parsed.truncated
          ? `Imported the ${sessions.length} most recent conversations (${turns} messages). Older chats in the file were left out.`
          : `Imported ${sessions.length} conversation${sessions.length === 1 ? "" : "s"} (${turns} messages).`,
      };
    } catch {
      if (file.name.toLowerCase().endsWith(".json")) {
        return { sessions: [], error: "That file is not valid JSON." };
      }
    }
  }

  const transcript = parseTranscript(raw);
  if (transcript.error) return { sessions: [], error: transcript.error };
  const session = toSession({
    startedAt: transcript.turns[0]?.at ?? Date.now(),
    turns: transcript.turns.map((turn) => ({ role: turn.role, text: turn.text, at: turn.at })),
  });
  return {
    sessions: [session],
    notice: `Imported 1 conversation (${session.turns.length} messages).`,
  };
}
