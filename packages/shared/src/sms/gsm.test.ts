import { describe, expect, it } from "vitest";
import { getSmsSegmentInfo, sanitiseForSms } from "./gsm";

describe("sanitiseForSms", () => {
  it("replaces Ghanaian letters that would force UCS-2", () => {
    expect(sanitiseForSms("Ɛfua and Kwabɛna Ɔwusu")).toBe("Efua and Kwabena Owusu");
  });

  it("replaces curly quotes, dashes and the cedi sign", () => {
    expect(sanitiseForSms("“Hi” — pay ₵5")).toBe('"Hi" - pay GHS 5');
  });

  it("strips accents GSM-7 cannot carry", () => {
    expect(sanitiseForSms("Amélie Kwê")).toBe("Amélie Kwe");
  });

  it("keeps the result in GSM-7", () => {
    const text = sanitiseForSms("Kɔfi Mɛnsah (Form 2 Sci A) was absent from Physics, Period 3");
    expect(getSmsSegmentInfo(text).encoding).toBe("GSM-7");
  });
});

describe("getSmsSegmentInfo", () => {
  it("counts 160 GSM-7 characters as one segment", () => {
    expect(getSmsSegmentInfo("a".repeat(160))).toEqual({ encoding: "GSM-7", units: 160, segments: 1 });
  });

  it("splits longer GSM-7 messages into 153 character segments", () => {
    expect(getSmsSegmentInfo("a".repeat(161)).segments).toBe(2);
  });

  it("counts extension characters as two septets", () => {
    expect(getSmsSegmentInfo("€".repeat(80)).units).toBe(160);
  });

  it("detects UCS-2 and its 70 character limit", () => {
    const info = getSmsSegmentInfo("ɛ" + "a".repeat(70));
    expect(info.encoding).toBe("UCS-2");
    expect(info.segments).toBe(2);
  });
});
