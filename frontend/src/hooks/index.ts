import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { fetchFeed, type FeedError } from '../lib/api'
import { earthquakesOnly, strongest } from '../lib/story'
import { DEFAULT_FILTERS, parseFilters, safeLevel, serializeFilters } from '../lib/filters'
import type { Filters, Level, Period } from '../lib/types'

export function useFeed(level: Level, period: Period) {
  return useQuery({
    queryKey: ['feed', level, period],
    queryFn: ({ signal }) => fetchFeed(level, period, signal),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    placeholderData: keepPreviousData,
    retry: (count, err) => (err as { kind?: string }).kind !== 'offline' && count < 2,
    retryDelay: (n) => Math.min(1000 * 2 ** n, 6000),
  })
}

/**
 * The story's data: the past day, or the past 7 days when the day has no rated earthquake.
 * Shares its cache with the explorer's default view.
 */
export function useStoryFeed() {
  const day = useFeed('all', 'day')
  const dayQuakes = useMemo(() => earthquakesOnly(day.data?.quakes ?? []), [day.data])
  const needWeek = !!day.data && !strongest(dayQuakes)
  const week = useQuery({
    queryKey: ['feed', 'all', 'week'],
    queryFn: ({ signal }) => fetchFeed('all', 'week', signal),
    enabled: needWeek,
    staleTime: 60_000,
  })
  const weekQuakes = useMemo(() => earthquakesOnly(week.data?.quakes ?? []), [week.data])
  const period: Period = needWeek ? 'week' : 'day'
  const quakes = needWeek ? weekQuakes : dayQuakes
  const hero = useMemo(() => strongest(quakes), [quakes])
  const src = needWeek ? week : day
  return {
    period,
    quakes,
    hero,
    generated: src.data?.generated ?? null,
    error: src.error as FeedError | null,
    loading: day.isPending || (needWeek && week.isPending),
    retry: () => (needWeek ? week.refetch() : day.refetch()),
  }
}

/** Filter state that lives in the URL, so every view can be shared or bookmarked. */
export function useFilters() {
  const [sp, setSp] = useSearchParams()
  const filters = useMemo(() => parseFilters(sp), [sp])

  const update = useCallback(
    (patch: Partial<Filters>) => {
      setSp(
        (prev) => {
          const next = { ...parseFilters(prev), ...patch }
          next.level = safeLevel(next.level, next.period)
          return keepEvent(prev, serializeFilters(next))
        },
        { replace: true },
      )
    },
    [setSp],
  )

  const reset = useCallback(() => {
    setSp(
      (prev) => {
        const cur = parseFilters(prev)
        return keepEvent(prev, serializeFilters({ ...DEFAULT_FILTERS, period: cur.period, level: cur.level, clouds: cur.clouds }))
      },
      { replace: true },
    )
  }, [setSp])

  const eventId = sp.get('event')
  const setEvent = useCallback(
    (id: string | null) => {
      setSp(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (id) next.set('event', id)
          else next.delete('event')
          return next
        },
        { replace: true },
      )
    },
    [setSp],
  )

  return { filters, update, reset, eventId, setEvent }
}

function keepEvent(prev: URLSearchParams, next: URLSearchParams) {
  const ev = prev.get('event')
  if (ev) next.set('event', ev)
  return next
}

export function useNow(interval = 15_000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), interval)
    return () => clearInterval(id)
  }, [interval])
  return now
}

export function useDebounced<T>(value: T, delay = 220) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setV(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return v
}

export function useOnline() {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return online
}

export function useMedia(query: string) {
  const [match, setMatch] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches)
  useEffect(() => {
    const m = window.matchMedia(query)
    const fn = () => setMatch(m.matches)
    m.addEventListener('change', fn)
    return () => m.removeEventListener('change', fn)
  }, [query])
  return match
}
