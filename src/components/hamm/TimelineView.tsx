import { buildTimeline, scoreAsOf } from "@/lib/hamm/score";
import { useHamm } from "@/lib/hamm/store";
import { Card } from "@/components/hamm/ui";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const tooltipStyle = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: 12,
  color: "var(--color-fg)",
  fontSize: 13,
};

export function TimelineView() {
  const sessions = useHamm((state) => state.sessions);
  const humanLogs = useHamm((state) => state.humanLogs);
  const points = useMemo(
    () => buildTimeline(sessions, humanLogs),
    [sessions, humanLogs],
  );
  const latest = scoreAsOf(sessions, humanLogs);

  if (points.length === 0) {
    return (
      <Card>
        <h2 className="font-display text-3xl text-fg">No timeline yet</h2>
        <p className="mt-2 max-w-xl text-sm text-muted">
          Each day with a session or a human-time log becomes a point. The score on that day looks back
          seven days, so a slow climb is visible.
        </p>
      </Card>
    );
  }

  const first = points[0]!;
  const last = points[points.length - 1]!;
  const delta = last.score - first.score;

  return (
    <div className="grid gap-5">
      <Card>
        <h2 className="font-display text-3xl text-fg">Dependency timeline</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          {first.label} was {first.score}. {last.label} is {last.score}
          {delta === 0 ? ". The score has not moved." : delta > 0 ? `, up ${delta}.` : `, down ${Math.abs(delta)}.`}{" "}
          Today’s reading uses the last 7 days and is {latest.total} ({latest.band.toLowerCase()}).
        </p>
        <div className="mt-6 h-64 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--color-border)" vertical={false} />
              <XAxis
                dataKey="label"
                stroke="var(--color-muted)"
                tickLine={false}
                axisLine={false}
                fontSize={12}
              />
              <YAxis
                domain={[0, 100]}
                stroke="var(--color-muted)"
                tickLine={false}
                axisLine={false}
                fontSize={12}
                width={32}
              />
              <Tooltip contentStyle={tooltipStyle} />
              <Line
                type="monotone"
                dataKey="score"
                name="Risk score"
                stroke="var(--color-primary)"
                strokeWidth={2.5}
                dot={{ r: 4, fill: "var(--color-primary)" }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card>
        <h2 className="font-display text-2xl text-fg">Minutes that day</h2>
        <p className="mt-1 text-sm text-muted">
          Terracotta is AI session time. Ink is human time you logged. These are daily totals, not the
          seven-day window used by the score.
        </p>
        <div className="mt-6 h-64 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={points} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--color-border)" vertical={false} />
              <XAxis
                dataKey="label"
                stroke="var(--color-muted)"
                tickLine={false}
                axisLine={false}
                fontSize={12}
              />
              <YAxis
                stroke="var(--color-muted)"
                tickLine={false}
                axisLine={false}
                fontSize={12}
                width={32}
              />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="aiMinutes" name="AI minutes" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
              <Bar dataKey="humanMinutes" name="Human minutes" fill="var(--color-fg)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card>
        <h2 className="font-display text-2xl text-fg">Day by day</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted">
                <th className="py-2 font-medium">Day</th>
                <th className="py-2 font-medium">Score</th>
                <th className="py-2 font-medium">Band</th>
                <th className="py-2 font-medium">AI</th>
                <th className="py-2 font-medium">Human</th>
                <th className="py-2 font-medium">Sessions</th>
              </tr>
            </thead>
            <tbody>
              {points.map((point) => (
                <tr key={point.date} className="border-b border-border last:border-0">
                  <td className="py-3 text-fg">{point.label}</td>
                  <td className="py-3 tabular-nums text-fg">{point.score}</td>
                  <td className="py-3 text-fg">{point.band}</td>
                  <td className="py-3 tabular-nums text-fg">{point.aiMinutes} min</td>
                  <td className="py-3 tabular-nums text-fg">{point.humanMinutes} min</td>
                  <td className="py-3 tabular-nums text-fg">{point.sessions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
