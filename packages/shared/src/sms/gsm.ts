/**
 * SMS cost control.
 *
 * A message that uses only GSM-7 characters fits 160 characters in one segment
 * (153 per segment when split). A single character outside GSM-7, such as the
 * Ghanaian letters ɛ and ɔ or a curly quote, switches the whole message to
 * UCS-2: only 70 characters per segment (67 when split). That can double or
 * triple the cost, so every outgoing SMS is sanitised first.
 */

const GSM_BASIC =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ\u001bÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?" +
  "¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";

/** Extension characters cost two septets each (escape plus character). */
const GSM_EXTENDED = "^{}\\[~]|€\f";

const GSM_BASIC_SET = new Set(GSM_BASIC);
const GSM_EXTENDED_SET = new Set(GSM_EXTENDED);

/** Replacements for common characters that would force UCS-2. */
const REPLACEMENTS: Readonly<Record<string, string>> = {
  ɛ: "e",
  Ɛ: "E",
  ɔ: "o",
  Ɔ: "O",
  ŋ: "n",
  Ŋ: "N",
  "‘": "'",
  "’": "'",
  "“": '"',
  "”": '"',
  "–": "-",
  "—": "-",
  "…": "...",
  " ": " ",
  "₵": "GHS ",
};

export type SmsEncoding = "GSM-7" | "UCS-2";

export interface SmsSegmentInfo {
  encoding: SmsEncoding;
  /** Length in encoding units (septets for GSM-7, UTF-16 code units for UCS-2). */
  units: number;
  segments: number;
}

/** Replaces characters that would force UCS-2, and strips accents GSM-7 cannot carry. */
export function sanitiseForSms(text: string): string {
  let out = "";
  for (const char of text) {
    const replacement = REPLACEMENTS[char];
    if (replacement !== undefined) {
      out += replacement;
      continue;
    }
    if (GSM_BASIC_SET.has(char) || GSM_EXTENDED_SET.has(char)) {
      out += char;
      continue;
    }
    // Strip accents (for example "ê" becomes "e"); drop anything still unsupported.
    const stripped = char.normalize("NFD").replace(/[̀-ͯ]/g, "");
    if ([...stripped].every((c) => GSM_BASIC_SET.has(c))) {
      out += stripped;
    }
  }
  return out;
}

export function getSmsSegmentInfo(text: string): SmsSegmentInfo {
  let septets = 0;
  let isGsm = true;

  for (const char of text) {
    if (GSM_BASIC_SET.has(char)) {
      septets += 1;
    } else if (GSM_EXTENDED_SET.has(char)) {
      septets += 2;
    } else {
      isGsm = false;
      break;
    }
  }

  if (isGsm) {
    const segments = septets <= 160 ? 1 : Math.ceil(septets / 153);
    return { encoding: "GSM-7", units: septets, segments: Math.max(segments, 1) };
  }

  const units = text.length;
  const segments = units <= 70 ? 1 : Math.ceil(units / 67);
  return { encoding: "UCS-2", units, segments: Math.max(segments, 1) };
}
