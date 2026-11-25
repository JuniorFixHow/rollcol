"use client";

import { WEEKDAYS } from "@rollcol/shared";
import { useState } from "react";
import { Notice, buttonClass } from "@/components/ui";
import { type DayInput, saveSchoolDay } from "./actions";

interface Row {
  on: boolean;
  opens: string;
  closes: string;
  breaks: { label: string; start: string; end: string }[];
}

const input =
  "rounded-md border border-line bg-background px-2 py-1.5 text-sm tabular-nums focus:border-accent focus:outline-none";

/** The usual week: arrival, closing and breaks for each day. */
export function WeekEditor({ classId, initial, isOverride }: { classId: string | null; initial: DayInput[]; isOverride: boolean }) {
  const [rows, setRows] = useState<Record<number, Row>>(() => {
    const byDay = new Map(initial.map((d) => [d.weekday, d]));
    const empty = initial.length === 0;
    return Object.fromEntries(
      WEEKDAYS.map(({ weekday }) => {
        const d = byDay.get(weekday);
        return [
          weekday,
          d
            ? { on: true, opens: d.opens.slice(0, 5), closes: d.closes.slice(0, 5), breaks: d.breaks }
            : { on: empty && weekday <= 5, opens: "07:30", closes: "15:00", breaks: [] },
        ];
      }),
    );
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);

  function update(weekday: number, change: Partial<Row>) {
    setRows((current) => {
      const row = current[weekday];
      return row ? { ...current, [weekday]: { ...row, ...change } } : current;
    });
  }

  async function save(clear = false) {
    setSaving(true);
    setMessage(null);
    const days: DayInput[] = clear
      ? []
      : WEEKDAYS.flatMap(({ weekday }) => {
          const row = rows[weekday];
          return row?.on ? [{ weekday, opens: row.opens, closes: row.closes, breaks: row.breaks }] : [];
        });
    const result = await saveSchoolDay(classId, days);
    setSaving(false);
    setMessage(
      result.error
        ? { tone: "danger", text: result.error }
        : { tone: "success", text: clear ? "This class now follows the school's times." : "Saved. Parents who use the app have been told." },
    );
  }

  return (
    <div className="space-y-4">
      <ul className="divide-y divide-line rounded-lg border border-line">
        {WEEKDAYS.map(({ weekday, name }) => {
          const row = rows[weekday];
          if (!row) return null;
          return (
            <li key={weekday} className="space-y-2 px-4 py-3">
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex w-32 items-center gap-2 text-sm font-medium">
                  <input type="checkbox" checked={row.on} onChange={(e) => update(weekday, { on: e.target.checked })} />
                  {name}
                </label>
                {row.on ? (
                  <>
                    <input type="time" aria-label={`${name} arrival`} className={input} value={row.opens} onChange={(e) => update(weekday, { opens: e.target.value })} />
                    <span className="text-sm text-muted">to</span>
                    <input type="time" aria-label={`${name} closing`} className={input} value={row.closes} onChange={(e) => update(weekday, { closes: e.target.value })} />
                    <button
                      type="button"
                      className="text-sm font-medium text-accent hover:underline disabled:opacity-50"
                      disabled={row.breaks.length >= 4}
                      onClick={() => update(weekday, { breaks: [...row.breaks, { label: "Break", start: "10:00", end: "10:30" }] })}
                    >
                      Add a break
                    </button>
                  </>
                ) : (
                  <span className="text-sm text-muted">No school</span>
                )}
              </div>
              {row.on
                ? row.breaks.map((b, i) => (
                    <div key={`${weekday}-${i}`} className="ml-0 flex flex-wrap items-center gap-2 sm:ml-32">
                      <input
                        aria-label="Break name"
                        className={`${input} w-28`}
                        value={b.label}
                        maxLength={30}
                        onChange={(e) => update(weekday, { breaks: row.breaks.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })}
                      />
                      <input type="time" aria-label="Break starts" className={input} value={b.start} onChange={(e) => update(weekday, { breaks: row.breaks.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)) })} />
                      <span className="text-sm text-muted">to</span>
                      <input type="time" aria-label="Break ends" className={input} value={b.end} onChange={(e) => update(weekday, { breaks: row.breaks.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)) })} />
                      <button type="button" className="text-sm text-danger hover:underline" onClick={() => update(weekday, { breaks: row.breaks.filter((_, j) => j !== i) })}>
                        Remove
                      </button>
                    </div>
                  ))
                : null}
            </li>
          );
        })}
      </ul>
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
      <div className="flex flex-wrap gap-3">
        <button type="button" className={buttonClass("primary")} disabled={saving} onClick={() => void save()}>
          {saving ? "Saving..." : "Save times"}
        </button>
        {isOverride ? (
          <button type="button" className={buttonClass("secondary")} disabled={saving} onClick={() => void save(true)}>
            Use the school&apos;s times
          </button>
        ) : null}
      </div>
    </div>
  );
}
