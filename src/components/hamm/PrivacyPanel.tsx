import { useHamm } from "@/lib/hamm/store";
import { Button, Card } from "@/components/hamm/ui";
import { useState } from "react";

export function PrivacyPanel() {
  const sessions = useHamm((state) => state.sessions);
  const humanLogs = useHamm((state) => state.humanLogs);
  const faceSamples = useHamm((state) => state.faceSamples);
  const deleteStoredData = useHamm((state) => state.deleteStoredData);
  const [armed, setArmed] = useState(false);

  const exportData = () => {
    const payload = {
      notice: "EmotionAI local export. This is a risk indicator, not a medical diagnosis.",
      exportedAt: new Date().toISOString(),
      sessions,
      humanLogs,
      faceSamples,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "emotionai-export.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid gap-5">
      <Card>
        <h2 className="font-display text-3xl text-fg">Privacy</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Personal conversations and facial data stay on this device. The dependency score does not send
          your transcript anywhere.
        </p>
        <ul className="mt-5 grid gap-3">
          {[
            "Consent is required before any session is stored.",
            "Transcripts, timers, human-time logs, and expression labels sit in this browser’s local storage.",
            "Camera frames and uploaded photos are analyzed locally and are not kept.",
            "The expression library loads in the browser. The face model file is served with this app.",
            "Deleting stored data removes sessions, human logs, expression labels, and camera consent. The consent to use the instrument itself remains until you clear the site.",
          ].map((item) => (
            <li key={item} className="rounded-xl bg-bg px-3 py-3 text-sm text-fg">
              {item}
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <h2 className="font-display text-2xl text-fg">What the numbers mean</h2>
        <p className="mt-2 text-sm text-muted">
          The score looks back seven days. Each factor is capped, and the caps add up to 100. Points are
          evidence, not a clinical scale.
        </p>
        <ul className="mt-4 grid gap-2 text-sm text-fg">
          <li>Interaction frequency, up to 20 — sessions and your messages.</li>
          <li>Long conversations, up to 18 — average session length, timed or estimated from word count.</li>
          <li>Emotional intensity, up to 16 — emotion words, intensifiers, and reassurance.</li>
          <li>Repeated reassurance, up to 14 — asks such as “are you there” or “am I enough”.</li>
          <li>Personal disclosures, up to 12 — family, secrets, “I feel”, private detail.</li>
          <li>AI vs human time, up to 10 — only after you log time with people.</li>
          <li>AI influence flags, up to 10 — replies that discourage people or demand more AI contact.</li>
        </ul>
        <p className="mt-4 text-sm text-muted">0–30 low · 31–60 moderate · 61–100 high.</p>
      </Card>

      <Card>
        <h2 className="font-display text-2xl text-fg">Your record</h2>
        <p className="mt-2 text-sm text-muted">
          {sessions.length} session{sessions.length === 1 ? "" : "s"} · {humanLogs.length} human-time log
          {humanLogs.length === 1 ? "" : "s"} · {faceSamples.length} kept expression
          {faceSamples.length === 1 ? "" : "s"}.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button variant="ink" onClick={exportData} disabled={sessions.length + humanLogs.length + faceSamples.length === 0}>
            Export JSON
          </Button>
          <Button
            variant={armed ? "primary" : "ghost"}
            onClick={() => {
              if (!armed) {
                setArmed(true);
                return;
              }
              deleteStoredData();
              setArmed(false);
            }}
            disabled={sessions.length + humanLogs.length + faceSamples.length === 0}
          >
            {armed ? "Confirm delete stored data" : "Delete stored data"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
