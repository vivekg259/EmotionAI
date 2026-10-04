import { useHamm } from "@/lib/hamm/store";
import { useState } from "react";
import { Button } from "@/components/hamm/ui";

const POINTS = [
  {
    title: "Only what you provide",
    body: "Paste a transcript, upload a JSON or text export, or log a conversation turn by turn. Nothing is pulled from another account.",
  },
  {
    title: "Stays in this browser",
    body: "The score, timeline, and expression labels are saved locally. Camera frames and photos are not stored.",
  },
  {
    title: "A risk indicator",
    body: "Low, moderate, and high describe a pattern. They are not a diagnosis, and facial cues are imperfect.",
  },
];

export function ConsentGate() {
  const consent = useHamm((state) => state.consent);
  const [accepted, setAccepted] = useState(false);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center px-4 py-12 md:px-8">
      <p className="text-sm font-medium tracking-wide text-muted">Research instrument</p>
      <h1 className="mt-3 font-display text-4xl text-fg sm:text-5xl md:text-6xl">EmotionAI</h1>
      <p className="mt-3 max-w-xl text-lg text-fg">Human Affection Manipulation by AI</p>
      <p className="mt-4 max-w-xl text-base text-muted">
        This reads conversation patterns you choose to share, then explains a dependency-risk score. It
        does not decide how you feel, and it does not replace people.
      </p>
      <div className="mt-8 grid gap-3">
        {POINTS.map((point) => (
          <article key={point.title} className="rounded-2xl border border-border bg-surface px-4 py-4">
            <h2 className="font-display text-xl text-fg">{point.title}</h2>
            <p className="mt-1 text-sm text-muted">{point.body}</p>
          </article>
        ))}
      </div>
      <label className="mt-6 flex min-h-11 cursor-pointer items-start gap-3 rounded-2xl border border-border bg-surface px-4 py-4">
        <input
          type="checkbox"
          className="mt-1 size-5 accent-primary"
          checked={accepted}
          onChange={(event) => setAccepted(event.target.checked)}
        />
        <span className="text-sm text-fg">
          I understand this is a risk indicator, not medical advice, and I can delete the local record at
          any time.
        </span>
      </label>
      <div className="mt-6">
        <Button disabled={!accepted} onClick={() => consent()}>
          Begin on this device
        </Button>
      </div>
    </main>
  );
}
