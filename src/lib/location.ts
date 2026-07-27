import timezoneCoords from '../data/timezone-coords.json'

export type LocationSource = 'manual' | 'gps' | 'timezone' | 'fallback'

export interface Place {
  lat: number
  lon: number
  label: string
  source: LocationSource
}

export type GeoPermission = 'granted' | 'prompt' | 'denied' | 'unsupported'

const PLACE_KEY = 'daynight.place'
const PROMPT_KEY = 'daynight.geoPromptDismissed'

const ZONES = timezoneCoords as unknown as Record<string, [number, number]>

/**
 * Renamed zones, keyed by the retired name. The dataset uses current IANA
 * names throughout, so a device whose tzdata predates a rename reports a name
 * the table does not carry; these redirect it to the current spelling.
 */
const ZONE_ALIASES: Record<string, string> = {
  'Europe/Kiev': 'Europe/Kyiv',
  'Asia/Calcutta': 'Asia/Kolkata',
  'Asia/Saigon': 'Asia/Ho_Chi_Minh',
  'Asia/Rangoon': 'Asia/Yangon',
  'Asia/Katmandu': 'Asia/Kathmandu',
  'America/Buenos_Aires': 'America/Argentina/Buenos_Aires',
  'Asia/Istanbul': 'Europe/Istanbul',
  'US/Hawaii': 'Pacific/Honolulu',
}

/** ~1 km. The dial cannot resolve finer, so nothing finer is kept. */
export function roundCoord(value: number): number {
  return Math.round(value * 100) / 100
}

export function deviceTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

/** Current UTC offset of a zone, in minutes. */
function zoneOffsetMinutes(timeZone: string, at: Date): number | null {
  try {
    const name = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'longOffset',
    })
      .formatToParts(at)
      .find((part) => part.type === 'timeZoneName')?.value

    if (!name) return null
    if (name === 'GMT') return 0

    const match = /^GMT([+-])(\d{1,2})(?::(\d{2}))?$/.exec(name)
    if (!match) return null

    const sign = match[1] === '-' ? -1 : 1
    return sign * (Number(match[2]) * 60 + Number(match[3] ?? 0))
  } catch {
    return null
  }
}

/** `UTC`, `UTC+9`, `UTC-5`, `UTC+5:30`. */
export function utcOffsetLabel(timeZone: string, at: Date = new Date()): string {
  const minutes = zoneOffsetMinutes(timeZone, at)
  if (minutes === null) return timeZone
  if (minutes === 0) return 'UTC'

  const sign = minutes < 0 ? '-' : '+'
  const total = Math.abs(minutes)
  const hours = Math.floor(total / 60)
  const rest = total % 60

  return rest === 0
    ? `UTC${sign}${hours}`
    : `UTC${sign}${hours}:${String(rest).padStart(2, '0')}`
}

export function placeFromTimezone(): Place {
  const zone = deviceTimezone()
  const direct = ZONES[zone] ?? ZONES[ZONE_ALIASES[zone] ?? '']

  if (direct) {
    return { lat: direct[0], lon: direct[1], label: zone, source: 'timezone' }
  }

  // Unknown zone name: settle for any zone at the same current offset. Wrong
  // latitude is possible, but far better than defaulting to the equator.
  const now = new Date()
  const target = zoneOffsetMinutes(zone, now)
  if (target !== null) {
    for (const [candidate, coords] of Object.entries(ZONES)) {
      if (zoneOffsetMinutes(candidate, now) === target) {
        return { lat: coords[0], lon: coords[1], label: zone, source: 'timezone' }
      }
    }
  }

  return { lat: 0, lon: 0, label: 'Unknown location', source: 'fallback' }
}

export function loadOverride(): Place | null {
  try {
    const raw = localStorage.getItem(PLACE_KEY)
    if (!raw) return null

    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return null

    const { lat, lon, label } = parsed as Partial<Place>
    if (typeof lat !== 'number' || typeof lon !== 'number') return null
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null

    return {
      lat: roundCoord(lat),
      lon: roundCoord(lon),
      label: typeof label === 'string' && label ? label : 'Saved location',
      source: 'manual',
    }
  } catch {
    return null
  }
}

export function saveOverride(place: Place): void {
  const stored: Place = {
    lat: roundCoord(place.lat),
    lon: roundCoord(place.lon),
    label: place.label,
    source: 'manual',
  }
  try {
    // Safari private browsing (and a full storage quota) makes setItem throw
    // synchronously. This is called directly from UI handlers (Task 8), so a
    // storage failure must degrade to an in-memory-only session, not crash it.
    localStorage.setItem(PLACE_KEY, JSON.stringify(stored))
  } catch {
    // ignored: the chosen place still lives in memory for this session
  }
}

export function clearOverride(): void {
  try {
    localStorage.removeItem(PLACE_KEY)
  } catch {
    // ignored: same storage-unavailable case as saveOverride
  }
}

export function isPromptDismissed(): boolean {
  try {
    return localStorage.getItem(PROMPT_KEY) === '1'
  } catch {
    // Storage unreadable: behave as if the prompt was never dismissed.
    return false
  }
}

export function dismissPrompt(): void {
  try {
    localStorage.setItem(PROMPT_KEY, '1')
  } catch {
    // ignored: same storage-unavailable case as saveOverride
  }
}

/**
 * The place to render on the very first frame. Synchronous by design, and it
 * never touches geolocation — that only happens after the user acts on the
 * explanation modal.
 */
export function resolveInitialPlace(): Place {
  return loadOverride() ?? placeFromTimezone()
}

export async function geolocationPermission(): Promise<GeoPermission> {
  if (!navigator.geolocation) return 'unsupported'
  if (!navigator.permissions?.query) return 'prompt'

  try {
    const status = await navigator.permissions.query({ name: 'geolocation' })
    return status.state
  } catch {
    return 'prompt'
  }
}

/**
 * Coarse position only: sunrise and sunset move by seconds over a kilometre,
 * so there is no reason to ask the device for anything sharper.
 */
export function requestCoarsePosition(): Promise<Place> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          lat: roundCoord(position.coords.latitude),
          lon: roundCoord(position.coords.longitude),
          label: 'Your location',
          source: 'gps',
        }),
      (error) => reject(new Error(error.message || 'Could not get your location')),
      { enableHighAccuracy: false, maximumAge: 900_000, timeout: 8_000 },
    )
  })
}
