import { clockText, parseBreaks } from "@rollcol/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm, CheckboxField, FormMessage, InlineAction, SelectField, SubmitButton, TextField } from "@/components/form";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { ghanaToday } from "@/lib/parent";
import { shortDay } from "@/lib/parent-days";
import { addDayChange, cancelDayChange } from "./actions";
import { WeekEditor } from "./week-editor";

export const metadata: Metadata = { title: "School day" };

/** Arrival, breaks and closing for each weekday; class differences; one-off changes. */
export default async function SchoolDayPage({ searchParams }: { searchParams: Promise<{ class?: string }> }) {
  const { supabase, member } = await requireAdmin();
  if (member.school.type === "tertiary") redirect("/dashboard");
  const { class: classParam } = await searchParams;
  const today = ghanaToday();

  const [{ data: classes }, { data: times }, { data: changes }] = await Promise.all([
    supabase.from("classes").select("id, name").eq("school_id", member.school.id).is("archived_at", null).order("name"),
    supabase.from("school_day_times").select("class_id, weekday, opens_at, closes_at, breaks").eq("school_id", member.school.id),
    supabase
      .from("school_day_changes")
      .select("id, class_id, day, closed, opens_at, closes_at, note")
      .eq("school_id", member.school.id)
      .is("cancelled_at", null)
      .gte("day", today)
      .order("day"),
  ]);
  const classList = classes ?? [];
  const chosen = classList.find((c) => c.id === classParam) ?? null;
  const own = new Set((times ?? []).flatMap((t) => (t.class_id ? [t.class_id] : [])));
  const forEditor = (times ?? [])
    .filter((t) => t.class_id === (chosen?.id ?? null))
    .map((t) => ({ weekday: t.weekday, opens: t.opens_at, closes: t.closes_at, breaks: parseBreaks(t.breaks) }));
  const className = new Map(classList.map((c) => [c.id, c.name]));

  return (
    <>
      <PageHeader
        title="School day"
        description="When children arrive, their breaks and when school closes. Parents see each day's times in RollCol, and are told when they change."
      />
      <div className="space-y-6">
        <Card
          title={chosen ? `${chosen.name}'s times` : "The whole school"}
          description={
            chosen
              ? own.has(chosen.id)
                ? "This class has its own times. Use the school's times to remove them."
                : "This class follows the school's times. Save here to give it its own."
              : "The usual week. Give a class different times below if it needs them."
          }
        >
          <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted">Times for:</span>
            <Link
              href="/dashboard/school-day"
              className={`rounded-full px-3 py-1 ${chosen ? "border border-line hover:border-accent" : "bg-accent-soft font-medium text-accent"}`}
            >
              Whole school
            </Link>
            {classList.map((c) => (
              <Link
                key={c.id}
                href={`/dashboard/school-day?class=${c.id}`}
                className={`rounded-full px-3 py-1 ${chosen?.id === c.id ? "bg-accent-soft font-medium text-accent" : "border border-line hover:border-accent"}`}
              >
                {c.name}
                {own.has(c.id) ? " *" : ""}
              </Link>
            ))}
          </div>
          <WeekEditor key={chosen?.id ?? "school"} classId={chosen?.id ?? null} initial={forEditor} isOverride={Boolean(chosen && own.has(chosen.id))} />
          {own.size > 0 ? <p className="mt-3 text-xs text-muted">* has its own times</p> : null}
        </Card>

        <Card
          title="A different day"
          description="Closed, opening later or closing earlier on one day: for the whole school or some classes."
        >
          <ActionForm action={addDayChange} className="grid items-start gap-4 sm:grid-cols-2" resetOnSuccess>
            <TextField name="day" label="Day" type="date" min={today} />
            <SelectField
              name="kind"
              label="What changes"
              options={[
                { value: "closed", label: "School is closed" },
                { value: "times", label: "Different times" },
              ]}
              defaultValue="times"
            />
            <TextField name="opens" label="Arrival (if different)" type="time" />
            <TextField name="closes" label="Closing (if different)" type="time" />
            <SelectField
              name="who"
              label="For"
              options={[
                { value: "all", label: "The whole school" },
                { value: "some", label: "The classes ticked below" },
              ]}
              defaultValue="all"
            />
            <TextField name="note" label="Note for parents (optional)" hint="For example: Staff meeting." autoComplete="off" />
            {classList.length > 0 ? (
              <fieldset className="sm:col-span-2">
                <legend className="mb-2 text-sm font-medium">Classes</legend>
                <div className="flex flex-wrap gap-x-6 gap-y-2">
                  {classList.map((c) => (
                    <CheckboxField key={c.id} name={`class:${c.id}`} label={c.name} />
                  ))}
                </div>
              </fieldset>
            ) : null}
            <div className="sm:col-span-2">
              <CheckboxField
                name="notify"
                label="Tell the parents"
                description="In the RollCol app for parents who use it; by SMS (using credits) for the others."
                defaultChecked
              />
            </div>
            <div className="space-y-3 sm:col-span-2">
              <FormMessage />
              <SubmitButton pendingLabel="Saving...">Save the change</SubmitButton>
            </div>
          </ActionForm>
        </Card>

        <Card title="Coming changes">
          {(changes ?? []).length === 0 ? (
            <EmptyState>No changes coming up.</EmptyState>
          ) : (
            <ul className="divide-y divide-line rounded-lg border border-line">
              {(changes ?? []).map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="font-medium">
                      {shortDay(c.day)} · {c.class_id ? (className.get(c.class_id) ?? "A class") : "Whole school"}
                    </p>
                    <p className="text-sm text-muted">
                      {c.closed ? (
                        <Badge tone="warning">Closed</Badge>
                      ) : (
                        [c.opens_at ? `Arrival ${clockText(c.opens_at)}` : "", c.closes_at ? `Closing ${clockText(c.closes_at)}` : ""]
                          .filter(Boolean)
                          .join(" · ")
                      )}
                      {c.note ? ` · ${c.note}` : ""}
                    </p>
                  </div>
                  <InlineAction
                    action={cancelDayChange}
                    hidden={{ id: c.id }}
                    label="Cancel"
                    variant="secondary"
                    confirm="Cancel this change? Parents are not told again: send them a message if they already know."
                  />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
