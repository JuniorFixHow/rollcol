"use client";

import { type BillingCatalog, type PlanCode, formatCedis } from "@rollcol/shared";
import { useId, useState } from "react";

type Audience = "school" | "tertiary" | "workspace_classes" | "workspace_courses";

const AUDIENCES: { id: Audience; label: string }[] = [
  { id: "school", label: "Basic or SHS" },
  { id: "tertiary", label: "University or college" },
  { id: "workspace_classes", label: "My own classes" },
  { id: "workspace_courses", label: "My own courses" },
];

/** Terms or semesters in a school year. */
const PERIODS: Record<Audience, { word: string; perYear: number }> = {
  school: { word: "term", perYear: 3 },
  tertiary: { word: "semester", perYear: 2 },
  workspace_classes: { word: "term", perYear: 3 },
  workspace_courses: { word: "semester", perYear: 2 },
};

const MAX_STUDENTS = 100000;

function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-medium">{label}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={value === option.id}
            onClick={() => onChange(option.id)}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
              value === option.id ? "border-accent bg-accent-soft text-accent" : "border-line text-muted hover:text-foreground"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * Works out what a school or workspace pays, from the live price list. Plans
 * are paid per student, once per term or semester, for all students.
 */
export function PricingCalculator({ catalog }: { catalog: BillingCatalog }) {
  const studentsId = useId();
  const packId = useId();
  const [audience, setAudience] = useState<Audience>("school");
  const [schoolPlan, setSchoolPlan] = useState<"alerts" | "complete">("alerts");
  const [studentsText, setStudentsText] = useState("300");
  const [packCredits, setPackCredits] = useState(0);

  const plan: PlanCode =
    audience === "school" ? schoolPlan : audience === "tertiary" ? "standard" : audience === "workspace_classes" ? "workspace_alerts" : "workspace_standard";
  const sendsSms = plan === "alerts" || plan === "complete" || plan === "workspace_alerts";
  const { word, perYear } = PERIODS[audience];
  const freeLimit =
    audience === "school" ? catalog.free.non_tertiary : audience === "tertiary" ? catalog.free.tertiary : catalog.free.workspace;

  const parsed = Number(studentsText);
  const valid = studentsText.trim() !== "" && Number.isInteger(parsed) && parsed >= 1 && parsed <= MAX_STUDENTS;
  const students = valid ? parsed : 0;

  const pack = sendsSms ? catalog.packs.find((p) => p.credits === packCredits) : undefined;
  const planCost = students * catalog.prices[plan];
  const packCost = pack?.price ?? 0;
  const perPeriod = planCost + packCost;
  const includedCredits = plan === "complete" ? students * catalog.completeCreditsPerStudent : 0;
  const weeks = Math.round(catalog.trialDays / 7);

  return (
    <div className="grid gap-6 rounded-xl border border-line bg-surface p-6 md:grid-cols-[1fr_18rem]">
      <div className="space-y-5">
        <Segmented
          label="Who is it for?"
          options={AUDIENCES}
          value={audience}
          onChange={(value) => {
            setAudience(value);
            if (value === "tertiary" || value === "workspace_courses") setPackCredits(0);
          }}
        />
        {audience === "school" ? (
          <Segmented
            label="Plan"
            options={[
              { id: "alerts", label: "Alerts" },
              { id: "complete", label: "Complete" },
            ]}
            value={schoolPlan}
            onChange={setSchoolPlan}
          />
        ) : null}
        <div>
          <label htmlFor={studentsId} className="text-sm font-medium">
            Number of students
          </label>
          <input
            id={studentsId}
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_STUDENTS}
            step={1}
            value={studentsText}
            onChange={(event) => setStudentsText(event.target.value)}
            aria-invalid={!valid}
            aria-describedby={`${studentsId}-hint`}
            className="mt-2 block w-40 rounded-md border border-line bg-background px-3 py-2 text-sm tabular-nums focus:border-accent focus:outline-none"
          />
          <p id={`${studentsId}-hint`} className={`mt-1 text-xs ${valid ? "text-muted" : "text-danger"}`}>
            {valid ? "Every active student counts." : `Enter a whole number from 1 to ${MAX_STUDENTS.toLocaleString("en-GH")}.`}
          </p>
        </div>
        {sendsSms ? (
          <div>
            <label htmlFor={packId} className="text-sm font-medium">
              Extra SMS credits each {word}
            </label>
            <select
              id={packId}
              value={packCredits}
              onChange={(event) => setPackCredits(Number(event.target.value))}
              className="mt-2 block w-56 rounded-md border border-line bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
            >
              <option value={0}>None</option>
              {catalog.packs.map((p) => (
                <option key={p.credits} value={p.credits}>
                  {p.credits.toLocaleString("en-GH")} credits ({formatCedis(p.price)})
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted">For broadcasts and messages. Attendance alerts never use credits.</p>
          </div>
        ) : null}
      </div>

      <div className="rounded-lg bg-surface-muted p-5" aria-live="polite">
        <p className="text-sm text-muted">Each {word}</p>
        <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">{valid ? formatCedis(perPeriod) : "..."}</p>
        {valid ? (
          <dl className="mt-4 space-y-1.5 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted">
                {students.toLocaleString("en-GH")} × {formatCedis(catalog.prices[plan])}
              </dt>
              <dd className="tabular-nums">{formatCedis(planCost)}</dd>
            </div>
            {pack ? (
              <div className="flex justify-between gap-3">
                <dt className="text-muted">{pack.credits.toLocaleString("en-GH")} SMS credits</dt>
                <dd className="tabular-nums">{formatCedis(packCost)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-3 border-t border-line pt-1.5 font-medium">
              <dt>
                A school year ({perYear} {word}s)
              </dt>
              <dd className="tabular-nums">{formatCedis(perPeriod * perYear)}</dd>
            </div>
          </dl>
        ) : null}
        <ul className="mt-4 space-y-1.5 text-xs text-muted">
          {includedCredits > 0 ? <li>Includes {includedCredits.toLocaleString("en-GH")} SMS credits each {word}.</li> : null}
          {valid && students <= freeLimit ? (
            <li>
              {students.toLocaleString("en-GH")} students fit in the free plan (up to {freeLimit.toLocaleString("en-GH")}
              {audience.startsWith("workspace") ? " across your workspaces" : ""}){sendsSms ? ", without attendance SMS." : "."}
            </li>
          ) : null}
          {audience === "school" ? <li>New schools get {weeks} weeks of Complete free after RollCol verifies them.</li> : null}
          <li>Prices in Ghana cedis. No payment renews by itself.</li>
        </ul>
      </div>
    </div>
  );
}
