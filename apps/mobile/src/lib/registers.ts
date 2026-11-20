import {
  type Database,
  type RegisterMarks,
  describeDatabaseError,
  isAttendanceMark,
  marksToPayload,
} from "@rollcol/shared";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { useSyncExternalStore } from "react";
import { supabase } from "./supabase";

/**
 * Registers that keep working without data.
 *
 * Everything a teacher does is saved on the phone first and queued in an
 * "outbox". The outbox is sent to RollCol in order whenever there is a
 * connection: start the register, save marks, submit. Registers are created
 * with an id made on the phone, so marks can be taken before the register
 * exists on the server. If someone else already started the same register
 * today, the server returns theirs and the phone switches to it.
 */

type RegisterStatus = Database["public"]["Enums"]["register_status"];
export type TodayRow = Database["public"]["Functions"]["registers_today"]["Returns"][number];

export interface RosterStudent {
  id: string;
  name: string;
  number: string | null;
}

export interface LocalRegister {
  id: string;
  schoolId: string;
  classId: string;
  className: string;
  classSubjectId: string | null;
  subjectName: string | null;
  periodNumber: number | null;
  rewardMarks: number;
  date: string;
  status: RegisterStatus;
  closesAt: string | null;
  marks: RegisterMarks;
}

type Op =
  | { kind: "open"; registerId: string; classId: string; classSubjectId: string | null; periodNumber: number | null; rewardMarks: number }
  | { kind: "marks"; registerId: string; marks: RegisterMarks }
  | { kind: "submit"; registerId: string };

const KEY = {
  today: (schoolId: string) => `rollcol.registers.today.${schoolId}`,
  roster: (classId: string) => `rollcol.registers.roster.${classId}`,
  sheet: (registerId: string) => `rollcol.registers.sheet.${registerId}`,
  outbox: "rollcol.registers.outbox",
  ids: "rollcol.registers.ids",
};

// ---------------------------------------------------------------------------
// Small JSON storage helpers
// ---------------------------------------------------------------------------

async function readJson(key: string): Promise<unknown> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}

async function writeJson(key: string, value: unknown): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asMarks(value: unknown): RegisterMarks {
  const marks: RegisterMarks = {};
  if (!isRecord(value)) return marks;
  for (const [studentId, mark] of Object.entries(value)) {
    if (mark === null || isAttendanceMark(mark)) marks[studentId] = mark;
  }
  return marks;
}

function asOps(value: unknown): Op[] {
  if (!Array.isArray(value)) return [];
  const ops: Op[] = [];
  for (const item of value) {
    if (!isRecord(item) || typeof item.registerId !== "string") continue;
    if (item.kind === "open" && typeof item.classId === "string") {
      ops.push({
        kind: "open",
        registerId: item.registerId,
        classId: item.classId,
        classSubjectId: typeof item.classSubjectId === "string" ? item.classSubjectId : null,
        periodNumber: typeof item.periodNumber === "number" ? item.periodNumber : null,
        rewardMarks: typeof item.rewardMarks === "number" ? item.rewardMarks : 0,
      });
    } else if (item.kind === "marks") {
      ops.push({ kind: "marks", registerId: item.registerId, marks: asMarks(item.marks) });
    } else if (item.kind === "submit") {
      ops.push({ kind: "submit", registerId: item.registerId });
    }
  }
  return ops;
}

function asSheet(value: unknown): LocalRegister | null {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.classId !== "string") return null;
  const status = value.status === "submitted" || value.status === "closed" ? value.status : "open";
  return {
    id: value.id,
    schoolId: typeof value.schoolId === "string" ? value.schoolId : "",
    classId: value.classId,
    className: typeof value.className === "string" ? value.className : "",
    classSubjectId: typeof value.classSubjectId === "string" ? value.classSubjectId : null,
    subjectName: typeof value.subjectName === "string" ? value.subjectName : null,
    periodNumber: typeof value.periodNumber === "number" ? value.periodNumber : null,
    rewardMarks: typeof value.rewardMarks === "number" ? value.rewardMarks : 0,
    date: typeof value.date === "string" ? value.date : "",
    status,
    closesAt: typeof value.closesAt === "string" ? value.closesAt : null,
    marks: asMarks(value.marks),
  };
}

async function readIds(): Promise<Record<string, string>> {
  const value = await readJson(KEY.ids);
  const ids: Record<string, string> = {};
  if (isRecord(value)) for (const [from, to] of Object.entries(value)) if (typeof to === "string") ids[from] = to;
  return ids;
}

/** The id the server knows a register by (phone ids can be swapped for an existing one). */
export async function resolveRegisterId(registerId: string): Promise<string> {
  const ids = await readIds();
  return ids[registerId] ?? registerId;
}

export function ghanaToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Accra" }).format(new Date());
}

// ---------------------------------------------------------------------------
// Sync status, for the "saved on this phone" line
// ---------------------------------------------------------------------------

interface SyncState {
  pending: number;
  syncing: boolean;
  /** Set when RollCol refused a change (not a lost connection). */
  error: string | null;
}

let syncState: SyncState = { pending: 0, syncing: false, error: null };
const listeners = new Set<() => void>();

function setSyncState(patch: Partial<SyncState>) {
  syncState = { ...syncState, ...patch };
  for (const listener of listeners) listener();
}

export function useSyncState(): SyncState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => syncState,
  );
}

// ---------------------------------------------------------------------------
// Outbox
// ---------------------------------------------------------------------------

async function readOutbox(): Promise<Op[]> {
  return asOps(await readJson(KEY.outbox));
}

async function writeOutbox(ops: Op[]): Promise<void> {
  await writeJson(KEY.outbox, ops);
  setSyncState({ pending: ops.length });
}

async function enqueue(op: Op): Promise<void> {
  const ops = await readOutbox();
  const last = ops.at(-1);
  // Consecutive mark changes to the same register travel together.
  if (op.kind === "marks" && last?.kind === "marks" && last.registerId === op.registerId) {
    last.marks = { ...last.marks, ...op.marks };
  } else {
    ops.push(op);
  }
  await writeOutbox(ops);
}

/** Lost connection and similar problems are retried; refusals from RollCol are not. */
function isConnectionProblem(error: { code?: string; message: string }): boolean {
  if (error.code && /^([0-9A-Z]{5}|PGRST\d+)$/.test(error.code)) return false;
  return /network|fetch|timed? ?out|connection|offline/i.test(error.message) || !error.code;
}

let syncing: Promise<void> | null = null;

/** Sends everything waiting in the outbox, in order. Safe to call often. */
export function syncOutbox(): Promise<void> {
  if (!syncing) {
    syncing = runSync().finally(() => {
      syncing = null;
    });
  }
  return syncing;
}

async function runSync(): Promise<void> {
  let ops = await readOutbox();
  if (ops.length === 0) {
    setSyncState({ pending: 0, syncing: false });
    return;
  }
  setSyncState({ syncing: true, pending: ops.length });

  while (ops.length > 0) {
    const op = ops[0];
    if (!op) break;
    const serverId = await resolveRegisterId(op.registerId);
    let error: { code?: string; message: string } | null = null;

    if (op.kind === "open") {
      const result = await supabase.rpc("open_register", {
        p_id: op.registerId,
        p_class_id: op.classId,
        ...(op.classSubjectId ? { p_class_subject_id: op.classSubjectId } : {}),
        ...(op.periodNumber ? { p_period_number: op.periodNumber } : {}),
        p_reward_marks: op.rewardMarks,
      });
      error = result.error;
      if (!error && result.data && result.data.id !== op.registerId) {
        // Someone already started this register today: use theirs from now on.
        const ids = await readIds();
        ids[op.registerId] = result.data.id;
        await writeJson(KEY.ids, ids);
      }
      if (!error && result.data) await refreshSheetMeta(op.registerId, result.data);
    } else if (op.kind === "marks") {
      const payload = marksToPayload(op.marks);
      if (payload.length > 0) {
        const result = await supabase.rpc("save_register_marks", { p_register_id: serverId, p_marks: payload });
        error = result.error;
      }
    } else {
      const result = await supabase.rpc("submit_register", { p_register_id: serverId });
      error = result.error;
      if (!error && result.data) await refreshSheetMeta(op.registerId, result.data);
    }

    if (error && isConnectionProblem(error)) {
      // Try again later; keep everything in order.
      setSyncState({ syncing: false, pending: ops.length });
      return;
    }
    if (error) setSyncState({ error: describeDatabaseError(error) });
    else if (syncState.error) setSyncState({ error: null });

    ops = ops.slice(1);
    // Read again in case more was queued while this one was sending.
    const latest = await readOutbox();
    const sent = latest[0];
    ops = sent && sent.kind === op.kind && sent.registerId === op.registerId ? latest.slice(1) : latest;
    if (sent && sent.kind === "marks" && op.kind === "marks" && sent.registerId === op.registerId) {
      // Marks queued after this batch started were merged into it; send what is new.
      const newer: RegisterMarks = {};
      for (const [studentId, mark] of Object.entries(sent.marks)) {
        if (op.marks[studentId] !== mark) newer[studentId] = mark;
      }
      if (Object.keys(newer).length > 0) ops = [{ kind: "marks", registerId: op.registerId, marks: newer }, ...ops];
    }
    await writeOutbox(ops);
  }

  setSyncState({ syncing: false, pending: 0 });
}

async function refreshSheetMeta(registerId: string, row: Database["public"]["Tables"]["registers"]["Row"]) {
  const sheet = asSheet(await readJson(KEY.sheet(registerId)));
  if (!sheet) return;
  await writeJson(KEY.sheet(registerId), { ...sheet, status: row.status, closesAt: row.closes_at, date: row.register_date });
}

// ---------------------------------------------------------------------------
// Today's registers and class lists
// ---------------------------------------------------------------------------

export async function loadToday(schoolId: string): Promise<{ rows: TodayRow[]; fromPhone: boolean }> {
  const { data, error } = await supabase.rpc("registers_today", { p_school_id: schoolId });
  if (!error) {
    await writeJson(KEY.today(schoolId), { date: ghanaToday(), rows: data });
    // Keep every class list on the phone too, so a register can be started offline later.
    const classIds = [...new Set(data.map((row) => row.class_id))];
    void Promise.allSettled(classIds.map((classId) => loadRoster(classId)));
    return { rows: data, fromPhone: false };
  }
  const cached = await readJson(KEY.today(schoolId));
  if (isRecord(cached) && cached.date === ghanaToday() && Array.isArray(cached.rows)) {
    // Saved by this app from the same RPC, so the shape matches.
    return { rows: cached.rows as TodayRow[], fromPhone: true };
  }
  throw new Error(describeDatabaseError(error));
}

export async function loadRoster(classId: string): Promise<RosterStudent[]> {
  const { data, error } = await supabase
    .from("students")
    .select("id, full_name, school_number")
    .eq("class_id", classId)
    .neq("status", "disabled")
    .order("full_name");
  if (!error) {
    const roster = data.map((s) => ({ id: s.id, name: s.full_name, number: s.school_number }));
    await writeJson(KEY.roster(classId), roster);
    return roster;
  }
  const cached = await readJson(KEY.roster(classId));
  if (Array.isArray(cached)) {
    return cached.flatMap((item) =>
      isRecord(item) && typeof item.id === "string" && typeof item.name === "string"
        ? [{ id: item.id, name: item.name, number: typeof item.number === "string" ? item.number : null }]
        : [],
    );
  }
  throw new Error("This class list is not on your phone yet. Connect to the internet once to load it.");
}

// ---------------------------------------------------------------------------
// One register
// ---------------------------------------------------------------------------

export async function startRegister(input: {
  schoolId: string;
  classId: string;
  className: string;
  classSubjectId: string | null;
  subjectName: string | null;
  periodNumber: number | null;
  rewardMarks: number;
}): Promise<string> {
  const id = Crypto.randomUUID();
  const sheet: LocalRegister = {
    id,
    schoolId: input.schoolId,
    classId: input.classId,
    className: input.className,
    classSubjectId: input.classSubjectId,
    subjectName: input.subjectName,
    periodNumber: input.periodNumber,
    rewardMarks: input.rewardMarks,
    date: ghanaToday(),
    status: "open",
    closesAt: null,
    marks: {},
  };
  await writeJson(KEY.sheet(id), sheet);
  await enqueue({
    kind: "open",
    registerId: id,
    classId: input.classId,
    classSubjectId: input.classSubjectId,
    periodNumber: input.periodNumber,
    rewardMarks: input.rewardMarks,
  });
  await syncOutbox();
  return resolveRegisterId(id);
}

/**
 * The register as RollCol has it, with any marks still waiting on this phone
 * laid on top. Falls back to the copy on the phone when offline.
 */
export async function loadRegister(registerId: string): Promise<LocalRegister> {
  const serverId = await resolveRegisterId(registerId);
  const cached = asSheet(await readJson(KEY.sheet(registerId))) ?? asSheet(await readJson(KEY.sheet(serverId)));

  const [registerResult, entriesResult] = await Promise.all([
    supabase
      .from("registers")
      .select(
        "id, school_id, class_id, class_subject_id, period_number, register_date, status, reward_marks, closes_at, class:classes(name), class_subject:class_subjects(subject:subjects(name))",
      )
      .eq("id", serverId)
      .maybeSingle(),
    supabase.from("register_entries").select("student_id, mark").eq("register_id", serverId),
  ]);

  let sheet: LocalRegister | null = cached;
  if (!registerResult.error && registerResult.data && !entriesResult.error) {
    const row = registerResult.data;
    const marks: RegisterMarks = {};
    for (const entry of entriesResult.data) if (isAttendanceMark(entry.mark)) marks[entry.student_id] = entry.mark;
    sheet = {
      id: row.id,
      schoolId: row.school_id,
      classId: row.class_id,
      className: row.class?.name ?? cached?.className ?? "",
      classSubjectId: row.class_subject_id,
      subjectName: row.class_subject?.subject?.name ?? cached?.subjectName ?? null,
      periodNumber: row.period_number,
      rewardMarks: Number(row.reward_marks),
      date: row.register_date,
      status: row.status,
      closesAt: row.closes_at,
      marks,
    };
  }
  if (!sheet) throw new Error("This register is not on your phone. Connect to the internet and try again.");

  // Marks not sent yet win over what the server has.
  for (const op of await readOutbox()) {
    if (op.kind === "marks" && (op.registerId === registerId || (await resolveRegisterId(op.registerId)) === sheet.id)) {
      sheet.marks = { ...sheet.marks, ...op.marks };
    }
    if (op.kind === "submit" && (await resolveRegisterId(op.registerId)) === sheet.id) sheet.status = "submitted";
  }

  await writeJson(KEY.sheet(registerId), sheet);
  return sheet;
}

export async function saveMarks(registerId: string, marks: RegisterMarks): Promise<void> {
  const sheet = asSheet(await readJson(KEY.sheet(registerId)));
  if (sheet) await writeJson(KEY.sheet(registerId), { ...sheet, marks: { ...sheet.marks, ...marks } });
  await enqueue({ kind: "marks", registerId, marks });
}

export async function submitRegister(registerId: string): Promise<void> {
  const sheet = asSheet(await readJson(KEY.sheet(registerId)));
  if (sheet) await writeJson(KEY.sheet(registerId), { ...sheet, status: "submitted" });
  await enqueue({ kind: "submit", registerId });
  await syncOutbox();
}

/** Starts the pending count when the app opens. */
export async function initOutbox(): Promise<void> {
  const ops = await readOutbox();
  setSyncState({ pending: ops.length });
  if (ops.length > 0) void syncOutbox();
}
