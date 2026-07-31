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

/**
 * A localStorage stand-in whose read/write methods throw, mimicking Safari
 * private browsing or a storage quota failure.
 */
function throwingStorage(): Storage {
  const boom = () => {
    throw new Error('storage unavailable')
  }
  return {
    get length() {
      return 0
    },
    clear: boom,
    getItem: boom,
    key: () => null,
    removeItem: boom,
    setItem: boom,
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

  it('round-trips a city timezone when one is given', () => {
    saveOverride({ ...kyiv, tz: 'Europe/Kyiv' })
    expect(loadOverride()?.tz).toBe('Europe/Kyiv')
  })

  it('omits the timezone rather than inventing one when none is given', () => {
    saveOverride(kyiv)
    expect(loadOverride()?.tz).toBeUndefined()
  })
})

describe('the dismissed-prompt flag', () => {
  it('starts unset and persists once set', () => {
    expect(isPromptDismissed()).toBe(false)
    dismissPrompt()
    expect(isPromptDismissed()).toBe(true)
  })
})

describe('storage failures (Safari private browsing, full quota)', () => {
  it('saveOverride does not throw when localStorage.setItem throws', () => {
    vi.stubGlobal('localStorage', throwingStorage())
    const place: Place = { lat: 10, lon: 20, label: 'Somewhere', source: 'manual' }
    expect(() => saveOverride(place)).not.toThrow()
  })

  it('dismissPrompt does not throw when localStorage.setItem throws', () => {
    vi.stubGlobal('localStorage', throwingStorage())
    expect(() => dismissPrompt()).not.toThrow()
  })

  it('clearOverride does not throw when localStorage.removeItem throws', () => {
    vi.stubGlobal('localStorage', throwingStorage())
    expect(() => clearOverride()).not.toThrow()
  })

  it('isPromptDismissed returns false rather than throwing when getItem throws', () => {
    vi.stubGlobal('localStorage', throwingStorage())
    expect(isPromptDismissed()).toBe(false)
  })
})

/**
 * Reports `zone` as the device zone. When `offsetName` is given, that zone's
 * own offset lookup answers with it (an `Intl.DateTimeFormat` `longOffset`
 * value such as `GMT+05:30`); every other zone is handed to the real `Intl`, so
 * the offset scan runs against genuine offsets. Without `offsetName` the zone
 * has no readable offset at all, which is what a name the platform rejects
 * looks like.
 */
function stubDeviceZone(zone: string, offsetName?: string): void {
  const real = Intl.DateTimeFormat
  // A `function`, not an arrow: callers use `new Intl.DateTimeFormat(...)`, and
  // an arrow is not constructible — every lookup would throw instead of
  // answering, which is precisely how the old version of the offset-scan test
  // managed never to run the scan.
  function impl(
    locales?: Intl.LocalesArgument,
    options?: Intl.DateTimeFormatOptions,
  ): Intl.DateTimeFormat {
    if (!options?.timeZone) {
      return {
        resolvedOptions: () => ({ timeZone: zone }),
      } as unknown as Intl.DateTimeFormat
    }
    if (options.timeZone === zone) {
      if (offsetName === undefined) throw new RangeError(`Invalid time zone: ${zone}`)
      return {
        formatToParts: () => [{ type: 'timeZoneName', value: offsetName }],
      } as unknown as Intl.DateTimeFormat
    }
    return real(locales, options)
  }

  vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(
    impl as unknown as typeof Intl.DateTimeFormat,
  )
}

describe('placeFromTimezone', () => {
  it('resolves the device zone to rounded coordinates', () => {
    // The test run's zone is pinned to Europe/Prague in vite.config.ts, and the
    // table carries it at 4dp — every path into the app rounds to 2.
    const place = placeFromTimezone()
    expect(place).toEqual({
      lat: 50.09,
      lon: 14.42,
      label: 'Europe/Prague',
      source: 'timezone',
      tz: 'Europe/Prague',
    })
  })

  it('resolves a renamed zone through the alias map', () => {
    stubDeviceZone('Europe/Kiev')

    const place = placeFromTimezone()
    expect(place.source).toBe('timezone')
    expect(place.lat).toBe(50.45)
    expect(place.lon).toBe(30.52)
  })

  it('resolves a bare UTC device zone to a mid-latitude zone, not the equator', () => {
    // Firefox with privacy.resistFingerprinting, Tor Browser and UTC-configured
    // containers all report these; none of them owns a city, so none is in the
    // table. Left to the offset scan they landed on Africa/Abidjan at 5°N.
    for (const zone of ['UTC', 'Etc/UTC', 'Etc/GMT', 'Etc/Greenwich']) {
      stubDeviceZone(zone, 'GMT')

      const place = placeFromTimezone()
      expect(place).toEqual({
        lat: 51.51,
        lon: -0.13,
        label: zone,
        source: 'timezone',
        // The device's own zone, not the aliased coordinate donor — the dial
        // must run on UTC, not on London's summer clock.
        tz: zone,
      })
      expect(place.lat).toBeGreaterThan(40)
    }
  })

  it('borrows a same-offset zone for an unknown name, tagged offset not timezone', () => {
    // Drives the scan itself: the name is absent from the table and from the
    // alias map, but its offset reads fine, so the loop body runs. +05:30 is
    // held by Asia/Colombo and Asia/Kolkata, neither of which observes DST, and
    // the table is alphabetical, so the borrowed zone is Colombo year-round.
    stubDeviceZone('Mars/Olympus_Mons', 'GMT+05:30')

    const place = placeFromTimezone()
    expect(place).toEqual({
      lat: 6.94,
      lon: 79.85,
      label: 'Mars/Olympus_Mons',
      source: 'offset',
      // The zone read fine (its offset answered), so the dial runs on it even
      // though the coordinates are borrowed from another zone at that offset.
      tz: 'Mars/Olympus_Mons',
    })
  })

  it('falls back to 0,0 tagged fallback when an unknown zone has no readable offset', () => {
    stubDeviceZone('Mars/Olympus_Mons')

    const place = placeFromTimezone()
    expect(place.source).toBe('fallback')
    expect(place.lat).toBe(0)
    expect(place.lon).toBe(0)
    // A zone whose offset cannot be read cannot drive the dial either.
    expect(place.tz).toBeUndefined()
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
    expect(place).toEqual({
      lat: 50.46,
      lon: 30.51,
      label: 'Your location',
      source: 'gps',
      // A GPS fix runs on the device zone — Europe/Prague in the test run.
      tz: 'Europe/Prague',
    })
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
