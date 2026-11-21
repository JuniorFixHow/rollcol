import { SESSION_RADIUS } from "@rollcol/shared";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ActionForm, FormMessage, InlineAction, SubmitButton, TextField } from "@/components/form";
import { Badge, Card, EmptyState, Notice, PageHeader, Table, Td } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { addVenue, removeVenue, verifyVenue } from "../sessions/actions";
import { UseMyLocation } from "./use-my-location";

export const metadata: Metadata = { title: "Venues" };

export default async function VenuesPage() {
  const { supabase, member } = await requireStaff();
  if (member.school.type !== "tertiary") redirect("/dashboard");
  const isAdmin = member.role === "admin";

  const [{ data: venues }, { data: rules }] = await Promise.all([
    supabase.rpc("school_venues", { p_school_id: member.school.id }),
    supabase.from("school_settings").select("lecturers_add_venues").eq("school_id", member.school.id).maybeSingle(),
  ]);
  const canAdd = isAdmin || (rules?.lecturers_add_venues ?? true);
  const unverified = (venues ?? []).filter((venue) => !venue.verified).length;

  return (
    <>
      <PageHeader
        title="Venues"
        description="Lecture halls and classrooms. Students check in within a venue's radius. Lecturers can also use their own location when they start a session."
      />
      <div className="space-y-6">
        {isAdmin && unverified > 0 ? (
          <Notice tone="warning" title={`${unverified} ${unverified === 1 ? "venue" : "venues"} to verify`}>
            Lecturers added these. They can already be used. Check each location on the map, then verify it or remove
            it. Lecturers cannot add a second venue with the same name.
          </Notice>
        ) : null}

        {(venues ?? []).length === 0 ? (
          <EmptyState>No venues yet. Add the halls where lectures take place.</EmptyState>
        ) : (
          <Table search="Search venues" headers={["Venue", "Location", "Radius", ""]}>
            {(venues ?? []).map((venue) => (
              <tr key={venue.id}>
                <Td>
                  <span className="block font-medium">{venue.name}</span>
                  {venue.verified ? (
                    <Badge tone="success">Verified</Badge>
                  ) : (
                    <span className="flex flex-wrap items-center gap-2">
                      <Badge tone="warning">Unverified</Badge>
                      <span className="text-xs text-muted">Added by {venue.mine ? "you" : (venue.added_by ?? "a lecturer")}</span>
                    </span>
                  )}
                </Td>
                <Td className="text-sm">
                  <a
                    href={`https://www.google.com/maps?q=${venue.latitude},${venue.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-accent hover:underline"
                  >
                    {venue.latitude.toFixed(5)}, {venue.longitude.toFixed(5)}
                  </a>
                </Td>
                <Td className="text-sm tabular-nums">{venue.radius_m} m</Td>
                <Td>
                  <div className="flex flex-wrap justify-end gap-2">
                    {isAdmin && !venue.verified ? (
                      <InlineAction
                        action={verifyVenue}
                        hidden={{ venueId: venue.id }}
                        label="Verify"
                        variant="primary"
                        confirm={`Verify ${venue.name}? Check the location on the map first. It becomes the school's official record for this hall.`}
                      />
                    ) : null}
                    {isAdmin || (venue.mine && !venue.verified) ? (
                      <InlineAction
                        action={removeVenue}
                        hidden={{ venueId: venue.id }}
                        label="Remove"
                        variant="ghost"
                        confirm={`Remove ${venue.name}? Past sessions keep their location; new sessions cannot use it.`}
                      />
                    ) : null}
                  </div>
                </Td>
              </tr>
            ))}
          </Table>
        )}

        {canAdd ? (
          <Card
            title="Add a venue"
            description={
              isAdmin
                ? "Stand inside the venue with a phone (open RollCol in the phone's browser) and use your current location. Or copy the coordinates from Google Maps: press and hold on the spot, then copy the numbers."
                : "Stand inside the hall with your phone (open RollCol in the phone's browser) and use your current location. It is marked unverified until an admin checks it, but you and other lecturers can use it straight away."
            }
          >
            <ActionForm action={addVenue} resetOnSuccess className="grid items-start gap-4 sm:grid-cols-2">
              <TextField name="name" label="Name" placeholder="Main Lecture Hall" autoComplete="off" />
              <TextField
                name="radius"
                label="Check-in radius (metres)"
                type="number"
                inputMode="numeric"
                min={String(SESSION_RADIUS.min)}
                max={String(SESSION_RADIUS.max)}
                step="1"
                defaultValue={String(SESSION_RADIUS.default)}
                hint="Students must be within this distance. Use more for large halls."
              />
              <TextField name="latitude" label="Latitude" inputMode="decimal" placeholder="5.650812" autoComplete="off" />
              <TextField name="longitude" label="Longitude" inputMode="decimal" placeholder="-0.186964" autoComplete="off" />
              <div className="sm:col-span-2">
                <UseMyLocation />
              </div>
              <div className="space-y-3 sm:col-span-2">
                <FormMessage />
                <SubmitButton>Save venue</SubmitButton>
              </div>
            </ActionForm>
          </Card>
        ) : (
          <Notice tone="neutral" title="Only admins add venues">
            Your school has turned off adding venues by lecturers. You can still start a session at your current
            location.
          </Notice>
        )}
      </div>
    </>
  );
}
