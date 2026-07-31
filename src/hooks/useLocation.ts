import { useCallback, useEffect, useState } from 'react';
import { type City, cityToPlace } from '../lib/cities';
import {
  clearOverride,
  dismissPrompt,
  type GeoPermission,
  type GuessedSource,
  geolocationPermission,
  isGuessed,
  isPromptDismissed,
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
  /**
   * Which guess the location hint should own up to, or `null` when the hint
   * should not be on screen at all: the place is already stated rather than
   * guessed, the browser would refuse a request anyway, or the reader has
   * waved the hint away before.
   *
   * Never set on the very first render — `permission` is only known once its
   * promise settles — which is why the hint floats over the dial rather than
   * sitting in the panel, where its arrival a tick later would resize the
   * clock.
   */
  hint: GuessedSource | null;
  dismissHint: () => void;
  chooseCity: (city: City) => void;
  useDeviceLocation: () => void;
}

export function useLocation(): LocationState {
  const [place, setPlace] = useState<Place>(resolveInitialPlace);
  const [permission, setPermission] = useState<GeoPermission>('unsupported');
  const [error, setError] = useState<string | null>(null);
  const [hintDismissed, setHintDismissed] = useState(isPromptDismissed);

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
  // dialog — the hint's button is the only path to one.
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

  const dismissHint = useCallback(() => {
    setHintDismissed(true);
    dismissPrompt();
  }, []);

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

  return {
    place,
    permission,
    error,
    // `denied` and `unsupported` are deliberately excluded: there the hint's
    // button could not do anything, and the panel's "change" link already
    // leads to the city picker.
    hint: !hintDismissed && permission === 'prompt' && isGuessed(place.source) ? place.source : null,
    dismissHint,
    chooseCity,
    useDeviceLocation,
  };
}
