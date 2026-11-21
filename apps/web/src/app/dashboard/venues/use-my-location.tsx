"use client";

import { useRef, useState } from "react";
import { buttonClass } from "@/components/ui";

/** Fills the latitude and longitude fields of the surrounding form with this device's location. */
export function UseMyLocation() {
  const ref = useRef<HTMLDivElement>(null);
  const [note, setNote] = useState<{ tone: "muted" | "danger"; text: string } | null>(null);

  function locate() {
    if (!("geolocation" in navigator)) {
      setNote({ tone: "danger", text: "This browser cannot share its location." });
      return;
    }
    setNote({ tone: "muted", text: "Finding your location..." });
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const form = ref.current?.closest("form");
        const set = (name: string, value: number) => {
          const input = form?.elements.namedItem(name);
          if (input instanceof HTMLInputElement) input.value = value.toFixed(6);
        };
        set("latitude", position.coords.latitude);
        set("longitude", position.coords.longitude);
        const accuracy = Math.round(position.coords.accuracy);
        setNote(
          accuracy > 50
            ? {
                tone: "danger",
                text: `Accurate to about ${accuracy} metres, which is too rough. Laptops guess from Wi-Fi; stand in the venue with a phone and try again.`,
              }
            : { tone: "muted", text: `Accurate to about ${accuracy} metres.` },
        );
      },
      () => setNote({ tone: "danger", text: "Location was blocked. Allow location for this site and try again." }),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  }

  return (
    <div ref={ref} className="space-y-1">
      <button type="button" onClick={locate} className={buttonClass("secondary", "sm")}>
        Use my current location
      </button>
      {note ? <p className={`text-xs ${note.tone === "danger" ? "text-danger" : "text-muted"}`}>{note.text}</p> : null}
    </div>
  );
}
