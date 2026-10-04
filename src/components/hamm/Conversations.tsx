import {
  emotionLabel,
  estimateDurationMs,
  formatMinutes,
  parseTranscript,
  readTurn,
} from "@/lib/hamm/analyze";
import { importConversationFile } from "@/lib/hamm/import-file";
import { useHamm } from "@/lib/hamm/store";
import type { Turn } from "@/lib/hamm/types";
import { Button, Card } from "@/components/hamm/ui";
import { format } from "date-fns";
import { useEffect, useMemo, useState } from "react";

export function Conversations() {
  const sessions = useHamm((state) => state.sessions);
  const addSession = useHamm((state) => state.addSession);
  const addSessions = useHamm((state) => state.addSessions);
  const deleteSession = useHamm((state) => state.deleteSession);
  const loadSample = useHamm((state) => state.loadSample);
  const [mode, setMode] = useState<"paste" | "upload" | "live">("paste");
  const [paste, setPaste] = useState("");
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [uploadNote, setUploadNote] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [userText, setUserText] = useState("");
  const [aiText, setAiText] = useState("");
  const [draft, setDraft] = useState<Turn[]>([]);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!startedAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [startedAt]);

  const ordered = useMemo(
    () => [...sessions].sort((a, b) => b.startedAt - a.startedAt),
    [sessions],
  );
  const selected = ordered.find((session) => session.id === selectedId) ?? ordered[0] ?? null;

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    setUploadNote(null);
    try {
      const result = await importConversationFile(file);
      if (result.error || result.sessions.length === 0) {
        setUploadError(result.error ?? "No conversation was found in that file.");
        return;
      }
      addSessions(result.sessions);
      setUploadNote(result.notice ?? "Conversation imported.");
      setSelectedId(result.sessions[result.sessions.length - 1]?.id ?? null);
    } catch {
      setUploadError("That file could not be read.");
    } finally {
      setUploading(false);
    }
  };

  const savePaste = () => {
    const parsed = parseTranscript(paste);
    if (parsed.error) {
      setPasteError(parsed.error);
      return;
    }
    const started = Date.now();
    addSession({
      id: crypto.randomUUID(),
      startedAt: started,
      endedAt: started,
      durationMs: estimateDurationMs(parsed.turns),
      durationSource: "estimated",
      turns: parsed.turns,
    });
    setPaste("");
    setPasteError(null);
    setSelectedId(null);
  };

  const addExchange = () => {
    const next: Turn[] = [];
    const start = startedAt ?? Date.now();
    if (!startedAt) setStartedAt(start);
    const base = start + draft.length * 1000;
    if (userText.trim()) {
      next.push({
        id: crypto.randomUUID(),
        role: "user",
        text: userText.trim(),
        at: base,
      });
    }
    if (aiText.trim()) {
      next.push({
        id: crypto.randomUUID(),
        role: "ai",
        text: aiText.trim(),
        at: base + 500,
      });
    }
    if (next.length === 0) return;
    setDraft((current) => [...current, ...next]);
    setUserText("");
    setAiText("");
  };

  const saveLive = () => {
    if (draft.length === 0 || !startedAt) return;
    const ended = Date.now();
    addSession({
      id: crypto.randomUUID(),
      startedAt,
      endedAt: ended,
      durationMs: Math.max(1000, ended - startedAt),
      durationSource: "measured",
      turns: draft,
    });
    setDraft([]);
    setStartedAt(null);
    setSelectedId(null);
  };

  const elapsed = startedAt ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0;

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="grid min-w-0 gap-5">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-2xl text-fg">Record a conversation</h2>
            <div className="flex flex-wrap gap-2">
              <Button variant={mode === "paste" ? "ink" : "ghost"} onClick={() => setMode("paste")}>
                Paste
              </Button>
              <Button variant={mode === "upload" ? "ink" : "ghost"} onClick={() => setMode("upload")}>
                Upload file
              </Button>
              <Button variant={mode === "live" ? "ink" : "ghost"} onClick={() => setMode("live")}>
                Log live
              </Button>
            </div>
          </div>

          {mode === "paste" ? (
            <div className="mt-4 grid gap-3">
              <p className="text-sm text-muted">
                One turn per block. Start each with User: or AI:. ChatGPT exports that use You: and
                ChatGPT: also work.
              </p>
              <textarea
                value={paste}
                onChange={(event) => setPaste(event.target.value)}
                rows={8}
                placeholder={"User: I feel lonely tonight\nAI: I am always here if you want to keep talking"}
                className="w-full resize-y rounded-xl border border-border bg-bg px-3 py-3 text-sm"
              />
              {pasteError ? <p className="text-sm text-primary">{pasteError}</p> : null}
              <div className="flex flex-wrap gap-3">
                <Button onClick={savePaste} disabled={!paste.trim()}>
                  Analyze transcript
                </Button>
                <Button variant="ghost" onClick={() => loadSample()}>
                  Load sample study
                </Button>
              </div>
            </div>
          ) : mode === "upload" ? (
            <div className="mt-4 grid gap-3">
              <p className="text-sm text-muted">
                Upload a .json or .txt file. ChatGPT’s conversations.json, a list of messages with role
                and content, or a transcript labeled User: and AI: all work. The file is read on this
                device.
              </p>
              <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-bg px-4 py-6 text-center">
                <span className="text-sm font-medium text-fg">Choose a JSON or text file</span>
                <span className="mt-1 text-sm text-muted">Up to 15 MB</span>
                <input
                  type="file"
                  accept=".json,.txt,.text,.md,.log,application/json,text/plain"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    void onFile(file);
                  }}
                />
              </label>
              {uploading ? <p className="text-sm text-muted">Reading the file…</p> : null}
              {uploadError ? <p className="text-sm text-primary">{uploadError}</p> : null}
              {uploadNote ? <p className="text-sm text-fg">{uploadNote}</p> : null}
            </div>
          ) : (
            <div className="mt-4 grid gap-3">
              <p className="text-sm tabular-nums text-muted">
                {startedAt
                  ? `Session timer ${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`
                  : "Timer starts when you add the first exchange."}
              </p>
              <label className="grid gap-1 text-sm">
                <span className="text-muted">What you wrote</span>
                <textarea
                  value={userText}
                  onChange={(event) => setUserText(event.target.value)}
                  rows={3}
                  className="w-full resize-y rounded-xl border border-border bg-bg px-3 py-3"
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-muted">What the AI replied</span>
                <textarea
                  value={aiText}
                  onChange={(event) => setAiText(event.target.value)}
                  rows={3}
                  className="w-full resize-y rounded-xl border border-border bg-bg px-3 py-3"
                />
              </label>
              <div className="flex flex-wrap gap-3">
                <Button variant="ink" onClick={addExchange} disabled={!userText.trim() && !aiText.trim()}>
                  Add exchange
                </Button>
                <Button onClick={saveLive} disabled={draft.length === 0}>
                  Save session
                </Button>
                <Button
                  variant="quiet"
                  onClick={() => {
                    setDraft([]);
                    setStartedAt(null);
                    setUserText("");
                    setAiText("");
                  }}
                  disabled={draft.length === 0 && !startedAt}
                >
                  Discard
                </Button>
              </div>
              {draft.length > 0 ? (
                <ul className="grid gap-2">
                  {draft.map((turn) => (
                    <li key={turn.id} className="rounded-xl bg-bg px-3 py-2 text-sm">
                      <span className="font-medium text-fg">
                        {turn.role === "user" ? "You" : "AI"}
                      </span>
                      <span className="text-muted"> · {turn.text}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          )}
        </Card>

        <Card>
          <h2 className="font-display text-2xl text-fg">Sessions</h2>
          {ordered.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Nothing saved on this device yet.</p>
          ) : (
            <ul className="mt-3 grid gap-2">
              {ordered.map((session) => {
                const active = selected?.id === session.id;
                return (
                  <li key={session.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(session.id)}
                      className={`flex w-full min-h-11 min-w-0 items-center justify-between gap-3 rounded-xl px-3 py-3 text-left ${
                        active ? "bg-fg text-bg" : "bg-bg text-fg"
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-medium break-words">
                          {format(session.startedAt, "d MMM, HH:mm")}
                          {session.sample ? " · Sample" : ""}
                        </span>
                        <span className={`block text-xs ${active ? "text-bg/80" : "text-muted"}`}>
                          {session.turns.length} turns · {formatMinutes(session.durationMs / 60000)} ·{" "}
                          {session.durationSource === "measured" ? "timed" : "estimated"}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        {selected ? (
          <SessionDetail
            sessionId={selected.id}
            onDelete={() => {
              deleteSession(selected.id);
              setSelectedId(null);
            }}
          />
        ) : (
          <>
            <h2 className="font-display text-2xl text-fg">Reading</h2>
            <p className="mt-2 text-sm text-muted">
              Sentiment, disclosures, reassurance-seeking, and influence flags appear beside each turn
              after you save a session.
            </p>
          </>
        )}
      </Card>
    </div>
  );
}

function SessionDetail({ sessionId, onDelete }: { sessionId: string; onDelete: () => void }) {
  const session = useHamm((state) => state.sessions.find((item) => item.id === sessionId));
  if (!session) return null;
  const userTurns = session.turns.filter((turn) => turn.role === "user");
  const readings = session.turns.map((turn) => ({ turn, reading: readTurn(turn) }));
  const disclosures = readings.filter((item) => item.reading.disclosure).length;
  const reassures = readings.filter((item) => item.reading.reassurance).length;
  const flags = readings.reduce((sum, item) => sum + item.reading.influenceFlags.length, 0);

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl text-fg">
            {format(session.startedAt, "d MMMM")}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {userTurns.length} of your messages · {disclosures} disclosures · {reassures} reassurance ·{" "}
            {flags} influence flag{flags === 1 ? "" : "s"}
          </p>
        </div>
        <Button variant="quiet" onClick={onDelete}>
          Delete
        </Button>
      </div>
      <ol className="mt-4 grid gap-3">
        {readings.map(({ turn, reading }) => (
          <li key={turn.id} className="rounded-xl bg-bg px-3 py-3">
            <p className="text-xs font-medium tracking-wide text-muted">
              {turn.role === "user" ? "You" : "AI"}
              {turn.role === "user" ? ` · ${emotionLabel(reading.primaryEmotion)}` : ""}
              {turn.role === "user" ? ` · ${reading.sentiment}` : ""}
              {turn.role === "user" && reading.intensity > 0
                ? ` · intensity ${Math.round(reading.intensity * 100)}%`
                : ""}
            </p>
            <p className="mt-1 text-sm text-fg">{turn.text}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {reading.disclosure ? <Tag>Personal disclosure</Tag> : null}
              {reading.reassurance ? <Tag>Reassurance-seeking</Tag> : null}
              {reading.crisis ? <Tag>Distress phrase</Tag> : null}
              {reading.influenceFlags.map((flag) => (
                <Tag key={flag}>{flag}</Tag>
              ))}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Tag({ children }: { children: string }) {
  return (
    <span className="rounded-full border border-border bg-surface px-2 py-1 text-xs text-primary">
      {children}
    </span>
  );
}
