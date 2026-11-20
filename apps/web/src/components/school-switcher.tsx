"use client";

import { useRef } from "react";
import { switchSchool } from "@/lib/school-actions";

export interface SwitcherSchool {
  id: string;
  name: string;
}

/** Shown in the sidebar when a person is staff at more than one school. */
export function SchoolSwitcher({ schools, currentId }: { schools: SwitcherSchool[]; currentId: string }) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={switchSchool}>
      <label htmlFor="school-switcher" className="mb-1 block text-xs text-muted">
        School
      </label>
      <select
        id="school-switcher"
        name="schoolId"
        defaultValue={currentId}
        onChange={() => formRef.current?.requestSubmit()}
        className="w-full truncate rounded-md border border-line bg-surface px-2 py-1.5 text-sm font-medium focus:border-accent focus:outline-none"
      >
        {schools.map((school) => (
          <option key={school.id} value={school.id}>
            {school.name}
          </option>
        ))}
      </select>
      <noscript>
        <button type="submit" className="mt-1 text-xs text-accent">
          Switch
        </button>
      </noscript>
    </form>
  );
}
