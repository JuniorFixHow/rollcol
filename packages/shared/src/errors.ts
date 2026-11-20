/**
 * Turns database errors into messages people can act on.
 *
 * RollCol's own functions and triggers raise messages written for users, so
 * those pass through unchanged. Postgres's built-in messages (constraint names,
 * permission errors) are translated.
 */

interface DatabaseErrorLike {
  code?: string;
  message: string;
}

const CONSTRAINT_MESSAGES: Readonly<Record<string, string>> = {
  staff_school_number_unique: "Someone at this school already uses that school ID.",
  students_school_number_unique: "A student at this school already uses that school ID.",
  staff_school_user_unique: "This person is already on the staff of this school.",
  students_school_user_unique: "You have already joined this school.",
  guardians_phone_unique: "Another guardian at this school already uses that phone number.",
  guardian_links_unique: "This guardian is already linked to this student.",
  classes_name_unique: "A class with that name already exists.",
  subjects_name_unique: "A subject with that name already exists.",
  class_subjects_unique: "That subject is already on this class.",
  programmes_name_unique: "A programme with that name already exists.",
  batches_name_unique: "That programme already has a batch with this name.",
  courses_code_unique: "A course with that code already exists.",
  course_runs_unique: "That course is already set up for this semester.",
  academic_periods_no_overlap: "Those dates overlap another term or semester.",
  academic_periods_dates: "The end date must be after the start date.",
  course_runs_academic_period_id_school_id_fkey: "Courses still use this semester. Remove them first.",
};

const BUILT_IN = /violates|duplicate key|permission denied|row-level security|invalid input/i;

export function describeDatabaseError(error: DatabaseErrorLike): string {
  const constraint = /constraint "([^"]+)"/.exec(error.message)?.[1];
  if (constraint) {
    const known = CONSTRAINT_MESSAGES[constraint];
    if (known) return known;
  }

  if (!BUILT_IN.test(error.message) && error.message.length > 0) {
    return error.message;
  }

  switch (error.code) {
    case "42501":
      return "You do not have permission to do that.";
    case "23505":
      return "That already exists.";
    case "23503":
      return "That item is still in use, or it belongs to a different school.";
    case "23514":
    case "22P02":
      return "Some of those details are not valid.";
    default:
      return "Something went wrong. Please try again.";
  }
}
