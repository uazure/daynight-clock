import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearOverride,
  deviceTimezone,
  dismissPrompt,
  geolocationPermission,
  isPromptDismissed,
  loadOverride,
  placeFromTimezone,
  requestCoarsePosition,
  resolveInitialPlace,
  roundCoord,
  saveOverride,
  utcOffsetLabel,
  type Place,
} from './location'

/** Minimal in-memory localStorage, enough for the four keys this module uses. */
function fakeStorage(): Storage {
  const map = new Map<string, string>()
  return {
    get length() {
      return map.size
    },
    clear: () => map.clear(),
    getItem: (key) => map.get(key) ?? null,
    key: (index) => [...map.keys()][index] ?? null,
    removeItem: (key) => void map.delete(key),
    setItem: (key, value) => void map.set(key, value),
  } as Storage
}

beforeEach(() => {
  vi.stubGlobal('localStorage', fakeStorage())
  vi.stubGlobal('navigator', {})
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('roundCoord', () => {
  it('keeps two decimals, about a kilometre', () => {
    expect(roundCoord(50.4501)).toBe(50.45)
    expect(roundCoord(30.523456)).toBe(30.52)
    expect(roundCoord(-0.187)).toBe(-0.19)
    expect(roundCoord(0)).toBe(0)
  })
})

describe('the stored override', () => {
  const kyiv: Place = { lat: 50.45, lon: 30.52, label: 'Kyiv, UA', source: 'manual' }

  it('is absent to begin with', () => {
    expect(loadOverride()).toBeNull()
  })

  it('round-trips through storage', () => {
    saveOverride(kyiv)
    expect(loadOverride()).toEqual(kyiv)
  })

  it('rounds coordinates on the way in', () => {
    saveOverride({ ...kyiv, lat: 50.456789, lon: 30.5111 })
    expect(loadOverride()).toEqual({ ...kyiv, lat: 50.46, lon: 30.51 })
  })

  it('is always tagged manual, whatever it was tagged before', () => {
    saveOverride({ ...kyiv, source: 'gps' })
    expect(loadOverride()?.source).toBe('manual')
  })

  it('clears', () => {
    saveOverride(kyiv)
    clearOverride()
    expect(loadOverride()).toBeNull()
  })

  it('ignores corrupt stored JSON rather than throwing', () => {
    localStorage.setItem('daynight.place', '{not json')
    expect(loadOverride()).toBeNull()
  })

  it('ignores stored objects missing coordinates', () => {
    localStorage.setItem('daynight.place', JSON.stringify({ label: 'nowhere' }))
    expect(loadOverride()).toBeNull()
  })
})

describe('the dismissed-prompt flag', () => {
  it('starts unset and persists once set', () => {
    expect(isPromptDismissed()).toBe(false)
    dismissPrompt()
    expect(isPromptDismissed()).toBe(true)
  })
})

describe('placeFromTimezone', () => {
  it('resolves the device zone to coordinates', () => {
    const place = placeFromTimezone()
    expect(place.source).toBe('timezone')
    expect(Number.isFinite(place.lat)).toBe(true)
    expect(Number.isFinite(place.lon)).toBe(true)
    expect(place.lat).toBeGreaterThanOrEqual(-90)
    expect(place.lat).toBeLessThanOrEqual(90)
  })

  it('resolves a renamed zone through the alias map', () => {
    vi.spyOn(Intl, 'DateTimeFormat').mockReturnValue({
      resolvedOptions: () => ({ timeZone: 'Europe/Kiev' }),
    } as unknown as Intl.DateTimeFormat)

    const place = placeFromTimezone()
    expect(place.source).toBe('timezone')
    expect(place.lat).toBeCloseTo(50.4, 0)
    expect(place.lon).toBeCloseTo(30.5, 0)
  })

  it('falls back to 0,0 tagged fallback for an unknown zone with no offset match', () => {
    vi.spyOn(Intl, 'DateTimeFormat').mockReturnValue({
      resolvedOptions: () => ({ timeZone: 'Mars/Olympus_Mons' }),
      format: () => '',
    } as unknown as Intl.DateTimeFormat)

    const place = placeFromTimezone()
    expect(place.source).toBe('fallback')
    expect(place.lat).toBe(0)
    expect(place.lon).toBe(0)
  })
})

describe('resolveInitialPlace', () => {
  it('prefers a stored override over the timezone guess', () => {
    const manual: Place = { lat: 10, lon: 20, label: 'Somewhere', source: 'manual' }
    saveOverride(manual)
    expect(resolveInitialPlace()).toEqual(manual)
  })

  it('falls back to the timezone guess when nothing is stored', () => {
    expect(resolveInitialPlace().source).not.toBe('manual')
  })

  it('never requests geolocation', () => {
    const getCurrentPosition = vi.fn()
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } })
    resolveInitialPlace()
    expect(getCurrentPosition).not.toHaveBeenCalled()
  })
})

describe('geolocationPermission', () => {
  it('reports unsupported when the browser has no geolocation', async () => {
    vi.stubGlobal('navigator', {})
    await expect(geolocationPermission()).resolves.toBe('unsupported')
  })

  it('passes through the Permissions API state', async () => {
    for (const state of ['granted', 'prompt', 'denied'] as const) {
      vi.stubGlobal('navigator', {
        geolocation: {},
        permissions: { query: vi.fn().mockResolvedValue({ state }) },
      })
      await expect(geolocationPermission()).resolves.toBe(state)
    }
  })

  it('assumes prompt when the Permissions API is missing', async () => {
    vi.stubGlobal('navigator', { geolocation: {} })
    await expect(geolocationPermission()).resolves.toBe('prompt')
  })

  it('assumes prompt when the Permissions API rejects', async () => {
    vi.stubGlobal('navigator', {
      geolocation: {},
      permissions: { query: vi.fn().mockRejectedValue(new Error('nope')) },
    })
    await expect(geolocationPermission()).resolves.toBe('prompt')
  })
})

describe('requestCoarsePosition', () => {
  it('asks for low accuracy only, with a cache window and a timeout', async () => {
    const getCurrentPosition = vi.fn(
      (
        ok: PositionCallback,
        _fail?: PositionErrorCallback,
        _options?: PositionOptions,
      ) => {
        ok({ coords: { latitude: 1, longitude: 2 } } as GeolocationPosition)
      },
    )
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } })

    await requestCoarsePosition()

    const options = getCurrentPosition.mock.calls[0][2] as PositionOptions
    expect(options.enableHighAccuracy).toBe(false)
    expect(options.maximumAge).toBe(900_000)
    expect(options.timeout).toBe(8_000)
  })

  it('returns a rounded place tagged gps', async () => {
    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: (ok: PositionCallback) =>
          ok({
            coords: { latitude: 50.456789, longitude: 30.512345 },
          } as GeolocationPosition),
      },
    })

    const place = await requestCoarsePosition()
    expect(place).toEqual({ lat: 50.46, lon: 30.51, label: 'Your location', source: 'gps' })
  })

  it('rejects when the browser has no geolocation', async () => {
    vi.stubGlobal('navigator', {})
    await expect(requestCoarsePosition()).rejects.toThrow(/not supported/i)
  })

  it('rejects with the browser error when the user denies', async () => {
    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: (_ok: PositionCallback, fail?: PositionErrorCallback) =>
          fail?.({ code: 1, message: 'User denied Geolocation' } as GeolocationPositionError),
      },
    })
    await expect(requestCoarsePosition()).rejects.toThrow(/denied/i)
  })
})

describe('utcOffsetLabel', () => {
  it('formats a positive and a negative offset', () => {
    const midJanuary = new Date('2026-01-15T12:00:00Z')
    expect(utcOffsetLabel('Asia/Tokyo', midJanuary)).toBe('UTC+9')
    expect(utcOffsetLabel('America/New_York', midJanuary)).toBe('UTC-5')
  })

  it('formats UTC itself without a sign', () => {
    expect(utcOffsetLabel('UTC', new Date('2026-01-15T12:00:00Z'))).toBe('UTC')
  })

  it('includes the minutes for a half-hour zone', () => {
    expect(utcOffsetLabel('Asia/Kolkata', new Date('2026-01-15T12:00:00Z'))).toBe(
      'UTC+5:30',
    )
  })
})

describe('deviceTimezone', () => {
  it('returns a non-empty zone name', () => {
    expect(deviceTimezone().length).toBeGreaterThan(0)
  })
})
