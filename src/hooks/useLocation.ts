import { useCallback, useEffect, useState } from 'react'
import { cityToPlace, type City } from '../lib/cities'
import {
  clearOverride,
  dismissPrompt,
  geolocationPermission,
  isPromptDismissed,
  placeFromTimezone,
  requestCoarsePosition,
  resolveInitialPlace,
  saveOverride,
  type GeoPermission,
  type Place,
} from '../lib/location'

export interface LocationState {
  place: Place
  permission: GeoPermission
  error: string | null
  /** True while the explanation modal should be on screen. */
  askingConsent: boolean
  acceptConsent: () => void
  declineConsent: () => void
  chooseCity: (city: City) => void
  useDeviceLocation: () => void
}

export function useLocation(): LocationState {
  const [place, setPlace] = useState<Place>(resolveInitialPlace)
  const [permission, setPermission] = useState<GeoPermission>('unsupported')
  const [error, setError] = useState<string | null>(null)
  const [askingConsent, setAskingConsent] = useState(false)

  const locate = useCallback(async () => {
    setError(null)
    try {
      setPlace(await requestCoarsePosition())
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not get your location')
      setPermission(await geolocationPermission())
    }
  }, [])

  // Decide once, on mount, whether to ask. Nothing here can trigger a browser
  // permission dialog except the `granted` branch, where there is no dialog.
  useEffect(() => {
    let cancelled = false

    void geolocationPermission().then((state) => {
      if (cancelled) return
      setPermission(state)

      if (state === 'granted') {
        void locate()
        return
      }

      const stored = resolveInitialPlace()
      if (state === 'prompt' && !isPromptDismissed() && stored.source !== 'manual') {
        setAskingConsent(true)
      }
    })

    return () => {
      cancelled = true
    }
  }, [locate])

  const acceptConsent = useCallback(() => {
    setAskingConsent(false)
    dismissPrompt()
    void locate()
  }, [locate])

  const declineConsent = useCallback(() => {
    setAskingConsent(false)
    dismissPrompt()
  }, [])

  const chooseCity = useCallback((city: City) => {
    const chosen = cityToPlace(city)
    saveOverride(chosen)
    setPlace(chosen)
    setError(null)
  }, [])

  const useDeviceLocation = useCallback(() => {
    clearOverride()
    setPlace(placeFromTimezone())
    void locate()
  }, [locate])

  return {
    place,
    permission,
    error,
    askingConsent,
    acceptConsent,
    declineConsent,
    chooseCity,
    useDeviceLocation,
  }
}
