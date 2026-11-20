"use client";

import { useState } from "react";
import { RadioGroupField, TextField } from "@/components/form";

/** School details shared by the sign-up and onboarding forms. */
export function SchoolFields({
  defaults,
}: {
  defaults?: {
    name?: string;
    type?: string;
    registerMode?: string;
    contactPhone?: string;
    adminFullName?: string;
    adminSchoolId?: string;
  };
}) {
  const [type, setType] = useState(defaults?.type ?? "");

  return (
    <>
      <TextField name="name" label="School name" defaultValue={defaults?.name} autoComplete="organization" />
      <div onChange={(event) => setType((event.target as HTMLInputElement).value)}>
        <RadioGroupField
          name="type"
          label="Type of school"
          defaultValue={defaults?.type}
          options={[
            { value: "non_tertiary", label: "Basic or senior high", description: "Teachers mark registers. Parents get SMS alerts." },
            { value: "tertiary", label: "Tertiary", description: "Students check in on their phones." },
          ]}
        />
      </div>
      {type === "non_tertiary" ? (
        <RadioGroupField
          name="registerMode"
          label="How are registers taken?"
          defaultValue={defaults?.registerMode}
          options={[
            { value: "daily", label: "Once a day", description: "The class teacher marks the register each morning. Usual for basic schools." },
            { value: "per_period", label: "Every period", description: "Each subject teacher marks their period. Usual for SHS." },
          ]}
        />
      ) : null}
      <TextField
        name="contactPhone"
        label="School phone number"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="024 123 4567"
        defaultValue={defaults?.contactPhone}
      />
      <TextField name="adminFullName" label="Your full name" autoComplete="name" defaultValue={defaults?.adminFullName} />
      <TextField
        name="adminSchoolId"
        label="Your school ID"
        hint="Your staff number at the school. You can use it to sign in."
        autoCapitalize="characters"
        defaultValue={defaults?.adminSchoolId}
      />
    </>
  );
}
