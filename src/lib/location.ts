import timezoneCoords from '../data/timezone-coords.json';
import { zoneOffsetMinutes } from './time';

/**
 * Where a place's coordinates came from, in descending order of confidence.
 * `timezone` means the device's zone was found in the table (directly or
 * through an alias) — a real city in the right zone. `offset` is the weaker
 * guess below it: the zone name was unknown, so any zone at the same current
 * UTC offset was borrowed, which fixes the longitude but says nothing about
 * the latitude, and latitude is what the dial actually depends on.
 */
export type LocationSource = 'manual' | 'gps' | 'timezone' | 'offset' | 'fallback';

/**
 * The sources that are a guess rather than a statement — the ones the location
 * hint offers to improve. `manual` and `gps` are excluded because there is
 * nothing better to offer someone who has already said where they are.
 */
export type GuessedSource = Extract<LocationSource, 'timezone' | 'offset' | 'fallback'>;

const GUESSED_SOURCES: ReadonlySet<LocationSource> = new Set<LocationSource>(['timezone', 'offset', 'fallback']);

export function isGuessed(source: LocationSource): source is GuessedSource {
  return GUESSED_SOURCES.has(source);
}

export interface Place {
  lat: number;
  lon: number;
  label: string;
  source: LocationSource;
  /**
   * IANA zone the dial should run on: the city's own zone for `manual`
   * places, the device zone for `gps`/`timezone`/`offset` ones (a GPS fix is
   * wherever the device is). Absent only for `fallback` places and stored
   * overrides written before this field existed — renderers fall back to
   * `deviceTimezone()` then.
   */
  tz?: string;
}

export type GeoPermission = 'granted' | 'prompt' | 'denied' | 'unsupported';

const PLACE_KEY = 'daynight.place';

const ZONES = timezoneCoords as unknown as Record<string, [number, number]>;

/**
 * Renamed zones, keyed by the retired name. The dataset uses current IANA
 * names throughout, so a device whose tzdata predates a rename reports a name
 * the table does not carry; these redirect it to the current spelling.
 *
 * The `UTC`/`Etc/*` entries are not renames but the other common gap: the
 * table only holds zones that own a city, so it has no `UTC` row, while
 * Firefox with `privacy.resistFingerprinting`, Tor Browser and UTC-configured
 * containers all report exactly that. Left to the offset scan they resolved to
 * the alphabetically first zero-offset zone, `Africa/Abidjan` at 5°N, giving a
 * northern-European user an equatorial twelve-hour day. `Europe/London` is the
 * mid-latitude zero-offset zone in the table (the alternative, the table's
 * `Atlantic/Reykjavik`, sits at 64°N, near enough the Arctic Circle to be its
 * own kind of wrong), and the coordinates are all this map is consulted for —
 * London's summer DST never enters into it.
 */
const ZONE_ALIASES: Record<string, string> = {
  UTC: 'Europe/London',
  'Etc/UTC': 'Europe/London',
  'Etc/GMT': 'Europe/London',
  'Etc/Greenwich': 'Europe/London',
  'Europe/Kiev': 'Europe/Kyiv',
  'Asia/Calcutta': 'Asia/Kolkata',
  'Asia/Saigon': 'Asia/Ho_Chi_Minh',
  'Asia/Rangoon': 'Asia/Yangon',
  'Asia/Katmandu': 'Asia/Kathmandu',
  'America/Buenos_Aires': 'America/Argentina/Buenos_Aires',
  'Asia/Istanbul': 'Europe/Istanbul',
  'US/Hawaii': 'Pacific/Honolulu',
};

/** ~1 km. The dial cannot resolve finer, so nothing finer is kept. */
export function roundCoord(value: number): number {
  return Math.round(value * 100) / 100;
}

export function deviceTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** `UTC`, `UTC+9`, `UTC-5`, `UTC+5:30`. */
export function utcOffsetLabel(timeZone: string, at: Date = new Date()): string {
  const minutes = zoneOffsetMinutes(timeZone, at);
  if (minutes === null) {
    return timeZone;
  }
  if (minutes === 0) {
    return 'UTC';
  }

  const sign = minutes < 0 ? '-' : '+';
  const total = Math.abs(minutes);
  const hours = Math.floor(total / 60);
  const rest = total % 60;

  return rest === 0 ? `UTC${sign}${hours}` : `UTC${sign}${hours}:${String(rest).padStart(2, '0')}`;
}

export function placeFromTimezone(): Place {
  const zone = deviceTimezone();
  const direct = ZONES[zone] ?? ZONES[ZONE_ALIASES[zone] ?? ''];

  if (direct) {
    return {
      lat: roundCoord(direct[0]),
      lon: roundCoord(direct[1]),
      label: zone,
      source: 'timezone',
      // The device's own zone name, not the alias target: a `UTC` device gets
      // London's *coordinates*, but its dial must not follow London's DST.
      tz: zone,
    };
  }

  // Unknown zone name: settle for any zone at the same current offset. Better
  // than defaulting to the equator, but the table is sorted alphabetically, so
  // "first at this offset" skews low-latitude and the latitude can be badly
  // wrong. Tagged `offset`, not `timezone`, so the panel does not present a
  // borrowed latitude with the confidence of a real zone match.
  const now = new Date();
  const target = zoneOffsetMinutes(zone, now);
  if (target !== null) {
    for (const [candidate, coords] of Object.entries(ZONES)) {
      if (zoneOffsetMinutes(candidate, now) === target) {
        return {
          lat: roundCoord(coords[0]),
          lon: roundCoord(coords[1]),
          label: zone,
          source: 'offset',
          // The zone answered an offset query, so it can drive the dial even
          // though its coordinates had to be borrowed.
          tz: zone,
        };
      }
    }
  }

  return { lat: 0, lon: 0, label: 'Unknown location', source: 'fallback' };
}

export function loadOverride(): Place | null {
  try {
    const raw = localStorage.getItem(PLACE_KEY);
    if (!raw) {
      return null;
    }

    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      return null;
    }

    const { lat, lon, label, tz } = parsed as Partial<Place>;
    if (typeof lat !== 'number' || typeof lon !== 'number') {
      return null;
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return null;
    }

    return {
      lat: roundCoord(lat),
      lon: roundCoord(lon),
      label: typeof label === 'string' && label ? label : 'Saved location',
      source: 'manual',
      ...(typeof tz === 'string' && tz ? { tz } : {}),
    };
  } catch {
    return null;
  }
}

export function saveOverride(place: Place): void {
  const stored: Place = {
    lat: roundCoord(place.lat),
    lon: roundCoord(place.lon),
    label: place.label,
    source: 'manual',
    ...(place.tz ? { tz: place.tz } : {}),
  };
  try {
    // Safari private browsing (and a full storage quota) makes setItem throw
    // synchronously. This is called directly from UI handlers (Task 8), so a
    // storage failure must degrade to an in-memory-only session, not crash it.
    localStorage.setItem(PLACE_KEY, JSON.stringify(stored));
  } catch {
    // ignored: the chosen place still lives in memory for this session
  }
}

export function clearOverride(): void {
  try {
    localStorage.removeItem(PLACE_KEY);
  } catch {
    // ignored: same storage-unavailable case as saveOverride
  }
}

/*
 * `isPromptDismissed`/`dismissPrompt` and their `daynight.geoPromptDismissed`
 * key lived here until the first-run hint they belonged to was removed. Nothing
 * is asked on first run any more, so there is no answer to remember: the panel
 * states where the place came from, and the picker is where a fix is requested.
 * Old keys are simply never read again — harmless, and not worth a migration.
 */

/**
 * The place to render on the very first frame. Synchronous by design, and it
 * never touches geolocation — that only happens after the user acts on the
 * explanation modal.
 */
export function resolveInitialPlace(): Place {
  return loadOverride() ?? placeFromTimezone();
}

export async function geolocationPermission(): Promise<GeoPermission> {
  if (!navigator.geolocation) {
    return 'unsupported';
  }
  if (!navigator.permissions?.query) {
    return 'prompt';
  }

  try {
    const status = await navigator.permissions.query({ name: 'geolocation' });
    return status.state;
  } catch {
    return 'prompt';
  }
}

/**
 * Coarse position only: sunrise and sunset move by seconds over a kilometre,
 * so there is no reason to ask the device for anything sharper.
 */
export function requestCoarsePosition(): Promise<Place> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          lat: roundCoord(position.coords.latitude),
          lon: roundCoord(position.coords.longitude),
          label: 'Your location',
          source: 'gps',
          // A GPS fix is wherever the device is, so the device zone is the
          // fix's own zone.
          tz: deviceTimezone(),
        }),
      (error) => reject(new Error(error.message || 'Could not get your location')),
      { enableHighAccuracy: false, maximumAge: 900_000, timeout: 8_000 },
    );
  });
}
