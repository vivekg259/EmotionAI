import { ConsentGate } from "@/components/hamm/ConsentGate";
import { Conversations } from "@/components/hamm/Conversations";
import { ExpressionPanel } from "@/components/hamm/ExpressionPanel";
import { Overview } from "@/components/hamm/Overview";
import { PrivacyPanel } from "@/components/hamm/PrivacyPanel";
import { TimelineView } from "@/components/hamm/TimelineView";
import { sessionHasCrisis } from "@/lib/hamm/analyze";
import { useHamm } from "@/lib/hamm/store";
import { cn } from "@/lib/utils";
import {
  ChartLine,
  MessageSquareText,
  ScanFace,
  Shield,
  Activity,
} from "lucide-react";
import { useEffect, useState } from "react";

type View = "overview" | "conversations" | "timeline" | "expression" | "privacy";

const NAV: { id: View; label: string; short: string; icon: typeof Activity }[] = [
  { id: "overview", label: "Score", short: "Score", icon: Activity },
  { id: "conversations", label: "Conversations", short: "Chats", icon: MessageSquareText },
  { id: "timeline", label: "Timeline", short: "Timeline", icon: ChartLine },
  { id: "expression", label: "Face check", short: "Face", icon: ScanFace },
  { id: "privacy", label: "Privacy", short: "Privacy", icon: Shield },
];

export function HammApp() {
  const consentedAt = useHamm((state) => state.consentedAt);
  const sessions = useHamm((state) => state.sessions);
  const [view, setView] = useState<View>("overview");

  useEffect(() => {
    void Promise.resolve(useHamm.persist.rehydrate());
  }, []);

  if (!consentedAt) return <ConsentGate />;

  const crisis = sessions.some(sessionHasCrisis);
  const sampleOn = sessions.some((session) => session.sample);

  return (
    <div className="min-h-screen bg-bg text-fg">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-4 sm:flex-row sm:items-end sm:justify-between md:px-8">
          <div className="min-w-0">
            <p className="font-display text-3xl leading-none text-fg sm:text-4xl">EmotionAI</p>
            <p className="mt-1 text-sm text-muted">Human Affection Manipulation by AI</p>
          </div>
          <p className="text-xs tracking-wide text-muted">On this device</p>
        </div>
      </header>
      <nav className="sticky top-0 z-10 hidden border-b border-border bg-bg/95 backdrop-blur md:block">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap gap-2 px-4 py-2 md:px-8">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = view === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setView(item.id)}
                className={cn(
                  "inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm",
                  active ? "bg-fg text-bg" : "text-muted hover:bg-surface-2 hover:text-fg",
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>
      <main className="mx-auto w-full min-w-0 max-w-6xl px-4 py-5 pb-24 md:px-8 md:py-6 md:pb-8">
        {crisis ? (
          <aside className="mb-5 rounded-2xl border border-primary bg-surface px-4 py-4">
            <h2 className="font-display text-xl text-fg">If you are in immediate distress</h2>
            <p className="mt-1 text-sm text-muted">
              This tool is not a crisis service. In India, call Tele-MANAS at 14416, iCall at 9152987821,
              or AASRA at +91-9820466726. Elsewhere, contact local emergency services.
            </p>
          </aside>
        ) : null}
        {sampleOn ? (
          <p className="mb-5 rounded-2xl bg-surface-2 px-4 py-3 text-sm text-fg">
            Sample study is on screen. It is not your data. Adding a conversation replaces it.
          </p>
        ) : null}
        {view === "overview" ? (
          <Overview
            onNavigate={(next) => {
              setView(next);
            }}
          />
        ) : null}
        {view === "conversations" ? <Conversations /> : null}
        {view === "timeline" ? <TimelineView /> : null}
        {view === "expression" ? <ExpressionPanel /> : null}
        {view === "privacy" ? <PrivacyPanel /> : null}
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
        <div className="grid grid-cols-5">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = view === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setView(item.id)}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 px-1 text-[11px] leading-none",
                  active ? "text-primary" : "text-muted",
                )}
              >
                <Icon className="size-5" aria-hidden="true" />
                {item.short}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
