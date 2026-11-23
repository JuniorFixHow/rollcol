"use client";

import { useState } from "react";
import { Notice } from "@/components/ui";
import { type StaffNotificationKind, setNotificationSetting } from "./actions";

const KINDS: { kind: StaffNotificationKind; title: string; detail: string }[] = [
  {
    kind: "moves",
    title: "Workspace moves",
    detail: "Someone asks to move a workspace into your school, or your own request is approved or declined.",
  },
];

function Switch({ checked, disabled, label, onChange }: { checked: boolean; disabled: boolean; label: string; onChange: (value: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${
        checked ? "bg-accent" : "bg-line"
      }`}
    >
      <span className={`inline-block size-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : "translate-x-0.5"}`} />
    </button>
  );
}

export function NotificationSettings({ initial }: { initial: Record<StaffNotificationKind, boolean> }) {
  const [enabled, setEnabled] = useState(initial);
  const [saving, setSaving] = useState<StaffNotificationKind | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle(kind: StaffNotificationKind, value: boolean) {
    setError(null);
    setSaving(kind);
    setEnabled((current) => ({ ...current, [kind]: value }));
    const result = await setNotificationSetting(kind, value);
    setSaving(null);
    if (result.error) {
      setEnabled((current) => ({ ...current, [kind]: !value }));
      setError(result.error);
    }
  }

  return (
    <div className="space-y-3">
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <ul className="divide-y divide-line rounded-lg border border-line">
        {KINDS.map((k) => (
          <li key={k.kind} className="flex items-center gap-4 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{k.title}</p>
              <p className="text-sm text-muted">{k.detail}</p>
            </div>
            <Switch checked={enabled[k.kind]} disabled={saving === k.kind} label={k.title} onChange={(v) => void toggle(k.kind, v)} />
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted">Security notices, such as your account signing in on a new phone, are always sent.</p>
    </div>
  );
}
