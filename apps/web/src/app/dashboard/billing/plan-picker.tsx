"use client";

import { PLAN_INFO, type PlanCode, formatCedis } from "@rollcol/shared";
import { useState } from "react";
import { ActionForm, FormMessage, SelectField, SubmitButton, TextField } from "@/components/form";
import { startPurchase } from "./actions";

/**
 * Choosing a plan for a term or semester: the plan, the term, and how many
 * students. The total updates as you type; the database works out the real
 * amount when you pay.
 */
export function PlanPicker({
  plans,
  prices,
  periods,
  activeStudents,
  creditsPerStudent,
  word,
}: {
  plans: PlanCode[];
  prices: Record<PlanCode, number>;
  periods: { id: string; name: string; dates: string }[];
  activeStudents: number;
  creditsPerStudent: number;
  word: "term" | "semester";
}) {
  const [plan, setPlan] = useState<PlanCode>(plans[plans.length - 1] ?? "alerts");
  const [studentsText, setStudentsText] = useState(String(Math.max(activeStudents, 1)));
  const students = Number.parseInt(studentsText, 10);
  const valid = Number.isInteger(students) && students >= Math.max(activeStudents, 1);
  const total = valid ? students * prices[plan] : null;

  return (
    <ActionForm action={startPurchase} className="space-y-5">
      <input type="hidden" name="kind" value="plan" />
      <input type="hidden" name="plan" value={plan} />

      {plans.length > 1 ? (
        <fieldset>
          <legend className="text-sm font-medium">Plan</legend>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {plans.map((code) => {
              const info = PLAN_INFO[code];
              const active = code === plan;
              return (
                <label
                  key={code}
                  className={`cursor-pointer rounded-lg border p-4 ${active ? "border-accent bg-accent-soft" : "border-line hover:bg-surface-muted"}`}
                >
                  <input type="radio" name="planChoice" value={code} checked={active} onChange={() => setPlan(code)} className="sr-only" />
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="font-semibold">{info.name}</span>
                    <span className="text-sm">
                      {formatCedis(prices[code])} per student per {word}
                    </span>
                  </span>
                  <span className="mt-1 block text-sm text-muted">{info.summary}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : (
        <p className="text-sm">
          <span className="font-semibold">{PLAN_INFO[plan].name}</span>: {formatCedis(prices[plan])} per student per {word}.{" "}
          <span className="text-muted">{PLAN_INFO[plan].summary}</span>
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          name="periodId"
          label={word === "term" ? "Term" : "Semester"}
          defaultValue={periods[0]?.id}
          options={periods.map((period) => ({ value: period.id, label: `${period.name} (${period.dates})` }))}
        />
        <div onChange={(event) => setStudentsText((event.target as HTMLInputElement).value)}>
          <TextField
            name="students"
            label="Students"
            type="number"
            inputMode="numeric"
            defaultValue={studentsText}
            hint={`At least your ${Math.max(activeStudents, 1)} active ${activeStudents === 1 ? "student" : "students"}. Add room for new ones now, or later.`}
          />
        </div>
      </div>

      <div className="rounded-lg bg-surface-muted p-4 text-sm">
        {total === null ? (
          <p className="text-muted">Enter at least {Math.max(activeStudents, 1)} students to see the total.</p>
        ) : (
          <>
            <p className="text-lg font-semibold">
              {formatCedis(total)}
              <span className="ml-2 text-sm font-normal text-muted">
                {students} x {formatCedis(prices[plan])}
              </span>
            </p>
            {plan === "complete" ? (
              <p className="mt-1 text-muted">Includes {students * creditsPerStudent} SMS credits for broadcasts and messages.</p>
            ) : null}
            <p className="mt-1 text-muted">Paid once for the whole {word}. Mobile Money or card, through Paystack.</p>
          </>
        )}
      </div>

      <FormMessage />
      <SubmitButton pendingLabel="Opening Paystack...">{total === null ? "Pay with Paystack" : `Pay ${formatCedis(total)} with Paystack`}</SubmitButton>
    </ActionForm>
  );
}
