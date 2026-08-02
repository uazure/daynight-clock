import { useCallback, useEffect, useState } from 'react';
import { type City, cityToPlace } from '../lib/cities';
import {
  clearOverride,
  type GeoPermission,
  geolocationPermission,
  type Place,
  placeFromTimezone,
  requestCoarsePosition,
  resolveInitialPlace,
  saveOverride,
} from '../lib/location';

export interface LocationState {
  place: Place;
  permission: GeoPermission;
  error: string | null;
  chooseCity: (city: City) => void;
  useDeviceLocation: () => void;
  /**
   * Back to the place the app resolves on its own, with no city and no fix: the
   * guess made from the device's IANA zone.
   *
   * Distinct from `useDeviceLocation` in the one way that matters — it asks the
   * browser for nothing. Clearing a chosen city was only possible by way of *Use
   * my location*, which makes the way out of a wrong city a geolocation prompt,
   * and rule 4 is that a fix happens on an explicit request for one and not as a
   * side effect of something else. Someone who picked Tokyo by accident wants
   * their timezone back, not a permission dialog.
   *
   * For a `gps` place this resets the session only: with the permission already
   * granted, the next load takes a fix again, which is the documented resolver
   * chain doing its job rather than the reset failing. For a `manual` one it is
   * permanent, because the stored override is what it removes.
   */
  useTimezoneLocation: () => void;
}

export function useLocation(): LocationState {
  const [place, setPlace] = useState<Place>(resolveInitialPlace);
  const [permission, setPermission] = useState<GeoPermission>('unsupported');
  const [error, setError] = useState<string | null>(null);

  const locate = useCallback(async () => {
    setError(null);
    try {
      setPlace(await requestCoarsePosition());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not get your location');
      setPermission(await geolocationPermission());
    }
  }, []);

  // Read the permission state once, on mount. Nothing here can trigger a
  // browser permission dialog except the `granted` branch, where there is no
  // dialog — the picker's *Use my location* is the only path to one.
  useEffect(() => {
    let cancelled = false;

    void geolocationPermission().then((state) => {
      if (cancelled) {
        return;
      }
      setPermission(state);

      // A manually chosen city is an explicit decision and outranks every
      // automatic source, geolocation included — the spec's precedence is
      // stored override first, with a GPS fix only sharpening a *guess*.
      // Without this guard an already-granted permission would silently
      // overwrite the saved city on every load, leaving the override in
      // storage but never in effect. `useDeviceLocation()` stays the
      // deliberate way back to GPS: it clears the override first.
      const stored = resolveInitialPlace();
      if (stored.source === 'manual') {
        return;
      }

      if (state === 'granted') {
        void locate();
      }
    });

    return () => {
      cancelled = true;
    };
  }, [locate]);

  const chooseCity = useCallback((city: City) => {
    const chosen = cityToPlace(city);
    saveOverride(chosen);
    setPlace(chosen);
    setError(null);
  }, []);

  const useDeviceLocation = useCallback(() => {
    clearOverride();
    setPlace(placeFromTimezone());
    void locate();
  }, [locate]);

  // `useDeviceLocation` without the fix — see the note on the interface. The
  // error is cleared too: a failed geolocation attempt is not news about a place
  // the reader has just resolved another way.
  const useTimezoneLocation = useCallback(() => {
    clearOverride();
    setPlace(placeFromTimezone());
    setError(null);
  }, []);

  return {
    place,
    permission,
    error,
    chooseCity,
    useDeviceLocation,
    useTimezoneLocation,
  };
}
