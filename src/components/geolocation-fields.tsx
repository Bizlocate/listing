"use client";

import { useEffect, useState } from "react";

export function GeolocationFields() {
  const [coords, setCoords] = useState<{ lat: string; lng: string } | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: String(pos.coords.latitude), lng: String(pos.coords.longitude) }),
      () => {
        // No permission or unavailable — lat/lng simply stay empty. Not an error state.
      },
      { timeout: 5000 },
    );
  }, []);

  return (
    <>
      <input type="hidden" name="lat" value={coords?.lat ?? ""} />
      <input type="hidden" name="lng" value={coords?.lng ?? ""} />
    </>
  );
}
