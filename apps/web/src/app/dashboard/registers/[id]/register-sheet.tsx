"use client";

import { ATTENDANCE_MARKS, ATTENDANCE_MARK_LABELS, type AttendanceMark, type RegisterMarks } from "@rollcol/shared";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useConfirm } from "@/components/confirm-dialog";
import { buttonClass } from "@/components/ui";
import { saveMarks, submitRegister } from "../actions";

interface SheetStudent {
  id: string;
  name: string;
  number: string | null;
  /** Set when a parent reported this child absent for the register's day. */
  reported?: string | null;
}

type SaveState = { kind: "idle" } | { kind: "saving" } | { kind: "saved" } | { kind: "error"; message: string };

const SELECTED: Record<AttendanceMark, string> = {
  present: "border-success bg-success text-on-status",
  late: "border-warning bg-warning text-on-warning",
  absent: "border-danger bg-danger text-on-status",
};

const SAVE_DELAY_MS = 700;

export function RegisterSheet({
  registerId,
  students,
  initialMarks,
  editable,
  open,
}: {
  registerId: string;
  students: SheetStudent[];
  initialMarks: RegisterMarks;
  editable: boolean;
  open: boolean;
}) {
  const router = useRouter();
  const [marks, setMarks] = useState<RegisterMarks>(initialMarks);
  const [save, setSave] = useState<SaveState>({ kind: "idle" });
  const [submitting, startSubmit] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const pending = useRef<RegisterMarks>({});
  const [confirm, confirmDialog] = useConfirm();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(async (): Promise<boolean> => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const batch = pending.current;
    if (Object.keys(batch).length === 0) return true;
    pending.current = {};
    setSave({ kind: "saving" });
    const result = await saveMarks(registerId, batch);
    if (result.ok) {
      setSave(Object.keys(pending.current).length > 0 ? { kind: "saving" } : { kind: "saved" });
      return true;
    }
    // Keep the unsaved marks (newer taps win) so the next save sends them again.
    pending.current = { ...batch, ...pending.current };
    setSave({ kind: "error", message: result.message });
    return false;
  }, [registerId]);

  const queue = useCallback(
    (changes: RegisterMarks) => {
      pending.current = { ...pending.current, ...changes };
      setSave({ kind: "saving" });
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), SAVE_DELAY_MS);
    },
    [flush],
  );

  // Warn before leaving with marks not yet saved.
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (Object.keys(pending.current).length > 0) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  function setMark(studentId: string, mark: AttendanceMark) {
    // Tapping the chosen mark again clears it.
    const next = marks[studentId] === mark ? null : mark;
    setMarks((current) => ({ ...current, [studentId]: next }));
    queue({ [studentId]: next });
  }

  function markRestPresent() {
    const changes: RegisterMarks = {};
    for (const student of students) {
      if (!marks[student.id]) changes[student.id] = "present";
    }
    if (Object.keys(changes).length === 0) return;
    setMarks((current) => ({ ...current, ...changes }));
    queue(changes);
  }

  const counts = useMemo(() => {
    const result = { present: 0, late: 0, absent: 0, notMarked: 0 };
    for (const student of students) {
      const mark = marks[student.id];
      if (mark) result[mark] += 1;
      else result.notMarked += 1;
    }
    return result;
  }, [marks, students]);

  async function submit() {
    setSubmitError(null);
    if (counts.notMarked > 0) {
      const ok = await confirm({
        title: "Submit with children not marked?",
        message: `${counts.notMarked} ${counts.notMarked === 1 ? "child is" : "children are"} not marked. Unmarked children are not treated as absent, and their parents get no alert.`,
        confirmLabel: "Submit anyway",
        cancelLabel: "Keep marking",
      });
      if (!ok) return;
    }
    startSubmit(async () => {
      const saved = await flush();
      if (!saved) return;
      const result = await submitRegister(registerId);
      if (!result.ok) setSubmitError(result.message);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm" aria-live="polite">
          <span className="font-medium text-success">{counts.present} present</span>
          <span className="text-muted"> · </span>
          <span className="font-medium text-warning">{counts.late} late</span>
          <span className="text-muted"> · </span>
          <span className="font-medium text-danger">{counts.absent} absent</span>
          <span className="text-muted"> · {counts.notMarked} not marked</span>
        </p>
        {editable ? (
          <div className="flex items-center gap-3">
            <SaveStatus state={save} onRetry={() => void flush()} />
            {counts.notMarked > 0 ? (
              <button type="button" onClick={markRestPresent} className={buttonClass("secondary", "sm")}>
                Mark the rest present
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <ul className="divide-y divide-line rounded-md border border-line">
        {students.map((student) => {
          const current = marks[student.id] ?? null;
          return (
            <li key={student.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate font-medium">{student.name}</p>
                {student.number ? <p className="font-mono text-xs text-muted">{student.number}</p> : null}
                {student.reported ? <p className="text-xs font-medium text-warning">Parent reported absent: {student.reported}</p> : null}
              </div>
              <div role="group" aria-label={`Mark ${student.name}`} className="flex gap-1.5">
                {ATTENDANCE_MARKS.map((mark) => {
                  const selected = current === mark;
                  const { label, short } = ATTENDANCE_MARK_LABELS[mark];
                  return (
                    <button
                      key={mark}
                      type="button"
                      disabled={!editable}
                      aria-pressed={selected}
                      aria-label={`${label}${selected ? " (selected)" : ""}`}
                      onClick={() => setMark(student.id, mark)}
                      className={`h-9 min-w-9 rounded-md border px-2.5 text-sm font-medium transition-colors disabled:cursor-default ${
                        selected ? SELECTED[mark] : "border-line bg-surface text-muted enabled:hover:bg-surface-muted enabled:hover:text-foreground"
                      }`}
                    >
                      <span className="sm:hidden">{short}</span>
                      <span className="hidden sm:inline">{label}</span>
                    </button>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ul>

      {editable && open ? (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => void submit()} disabled={submitting} className={buttonClass("primary")}>
            {submitting ? "Submitting..." : "Submit register"}
          </button>
          {submitError ? (
            <p role="alert" className="text-sm text-danger">
              {submitError}
            </p>
          ) : null}
        </div>
      ) : null}
      {confirmDialog}
    </div>
  );
}

function SaveStatus({ state, onRetry }: { state: SaveState; onRetry: () => void }) {
  if (state.kind === "idle") return null;
  if (state.kind === "saving") return <span className="text-xs text-muted">Saving...</span>;
  if (state.kind === "saved") return <span className="text-xs text-success">All marks saved</span>;
  return (
    <span role="alert" className="text-xs text-danger">
      Not saved: {state.message}{" "}
      <button type="button" onClick={onRetry} className="font-medium underline">
        Try again
      </button>
    </span>
  );
}
