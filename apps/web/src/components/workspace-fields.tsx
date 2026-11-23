"use client";

import { useState } from "react";
import { RadioGroupField, TextField } from "@/components/form";

/** Workspace details shared by the sign-up and onboarding forms. */
export function WorkspaceFields({
  defaults,
}: {
  defaults?: { name?: string; type?: string; registerMode?: string; contactPhone?: string; fullName?: string };
}) {
  const [type, setType] = useState(defaults?.type ?? "");

  return (
    <>
      <div onChange={(event) => setType((event.target as HTMLInputElement).value)}>
        <RadioGroupField
          name="type"
          label="What do you teach?"
          defaultValue={defaults?.type}
          options={[
            {
              value: "non_tertiary",
              label: "Classes (basic, JHS or SHS level)",
              description: "You mark registers for your pupils, for example extra classes or a school not yet on RollCol.",
            },
            {
              value: "tertiary",
              label: "Courses (university or college level)",
              description: "Your students check in on their phones with the RollCol app.",
            },
          ]}
        />
      </div>
      {type === "non_tertiary" ? (
        <RadioGroupField
          name="registerMode"
          label="How do you take registers?"
          hint="You can change this later in Settings."
          defaultValue={defaults?.registerMode ?? "daily"}
          options={[
            { value: "daily", label: "Once a day", description: "One register for each class each day." },
            { value: "per_period", label: "Every lesson", description: "A register for each subject lesson." },
          ]}
        />
      ) : null}
      <TextField
        name="name"
        label="Workspace name"
        hint="Your students see this when they join. For example Mr. Ankrah's classes, or Dr. Ocran, Anatomy."
        defaultValue={defaults?.name}
      />
      <TextField
        name="fullName"
        label="Your full name"
        hint="With your title if you use one."
        autoComplete="name"
        defaultValue={defaults?.fullName}
      />
      <TextField
        name="contactPhone"
        label="Your phone number"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="024 123 4567"
        hint="Only RollCol sees this, to contact you about your workspace."
        defaultValue={defaults?.contactPhone}
      />
    </>
  );
}
