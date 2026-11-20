import { parsePhoneNumberFromString } from "libphonenumber-js";

/**
 * Normalises a phone number to E.164 (for example +233241234567).
 * Numbers without a country code are treated as Ghanaian, so "024 123 4567"
 * and "+233 24 123 4567" become the same guardian.
 * Returns null when the number is not a valid mobile or fixed line number.
 */
export function normalisePhone(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed.length === 0) return null;

  const parsed = parsePhoneNumberFromString(trimmed, "GH");
  if (!parsed || !parsed.isValid()) return null;

  return parsed.number;
}

/** Formats an E.164 number for display, for example "024 123 4567" for Ghanaian numbers. */
export function formatPhoneForDisplay(e164: string): string {
  const parsed = parsePhoneNumberFromString(e164);
  if (!parsed) return e164;
  return parsed.country === "GH" ? parsed.formatNational() : parsed.formatInternational();
}
