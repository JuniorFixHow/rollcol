"use client";

import { useEffect, useRef, useState } from "react";
import { buttonClass } from "@/components/ui";

type Found = { latitude: number; longitude: number; accuracy: number };

/**
 * When "My current location" is chosen in the Where list, finds this device's
 * location and puts it in hidden fields for the form.
 */
export function CurrentLocation({ selectName = "venueId" }: { selectName?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [found, setFound] = useState<Found | null>(null);
  const [status, setStatus] = useState<"idle" | "finding" | "blocked" | "unsupported">("idle");

  const locate = () => {
    if (!("geolocation" in navigator)) {
      setStatus("unsupported");
      return;
    }
    setStatus("finding");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFound({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
        setStatus("idle");
      },
      () => setStatus("blocked"),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  };

  // Start looking as soon as the lecturer picks "My current location".
  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    const onChange = (event: Event) => {
      const target = event.target;
      if (target instanceof HTMLSelectElement && target.name === selectName && target.value === "current") locate();
    };
    form.addEventListener("change", onChange);
    return () => form.removeEventListener("change", onChange);
  }, [selectName]);

  const accuracy = found ? Math.round(found.accuracy) : null;
  return (
    <div ref={ref} className="space-y-1 sm:col-span-2">
      <input type="hidden" name="latitude" value={found ? String(found.latitude) : ""} />
      <input type="hidden" name="longitude" value={found ? String(found.longitude) : ""} />
      <input type="hidden" name="accuracy" value={found ? String(found.accuracy) : ""} />
      <div className="flex flex-wrap items-center gap-3 rounded-md border border-line bg-surface-muted px-3 py-2 text-sm">
        {status === "finding" ? (
          <span className="text-muted">Finding your location...</span>
        ) : status === "blocked" ? (
          <span className="text-danger">Location was blocked. Allow location for this site, then try again.</span>
        ) : status === "unsupported" ? (
          <span className="text-danger">This browser cannot share its location. Choose a venue instead.</span>
        ) : accuracy === null ? (
          <span className="text-muted">Your location is used as the centre of the check-in area.</span>
        ) : accuracy > 100 ? (
          <span className="text-danger">
            Accurate to about {accuracy} metres, which is too rough (100 is needed). Laptops guess from Wi-Fi: choose a
            venue, or start the session in the RollCol app on your phone.
          </span>
        ) : (
          <span>
            Found, accurate to about {accuracy} metres.
            <a
              href={`https://www.google.com/maps?q=${found?.latitude},${found?.longitude}`}
              target="_blank"
              rel="noreferrer"
              className="ml-2 text-accent hover:underline"
            >
              Check on the map
            </a>
          </span>
        )}
        <button type="button" onClick={locate} className={buttonClass("secondary", "sm")}>
          {found ? "Find again" : "Find my location"}
        </button>
      </div>
    </div>
  );
}
