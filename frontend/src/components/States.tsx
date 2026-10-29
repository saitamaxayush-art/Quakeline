import { motion } from 'motion/react'
import { RotateCw, SearchX, WifiOff, ServerCrash } from 'lucide-react'
import { Button } from './ui'
import type { FeedError } from '../lib/api'

export function EmptyState({
  query,
  activeCount,
  total,
  onReset,
  onWiden,
  canWiden,
}: {
  query: string
  activeCount: number
  total: number
  onReset: () => void
  onWiden: () => void
  canWiden: boolean
}) {
  const noData = total === 0
  return (
    <motion.div className="state" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="state-icon">
        <SearchX size={26} aria-hidden="true" />
      </div>
      <h3>{noData ? 'The feed has no events for this window' : 'No events match these filters'}</h3>
      <p>
        {noData
          ? 'Quiet periods happen, especially in the past hour or with a high magnitude floor. Try a longer window.'
          : query
            ? `Nothing in the current ${total.toLocaleString('en')} events mentions "${query}". Place names come from the USGS, for example "Alaska", "Japan" or "CA".`
            : `All ${total.toLocaleString('en')} events in this window were filtered out.`}
      </p>
      <div className="state-actions">
        {activeCount > 0 && <Button onClick={onReset}>Clear {activeCount === 1 ? 'filter' : `${activeCount} filters`}</Button>}
        {canWiden && (
          <Button variant="outline" onClick={onWiden}>
            Look at a longer window
          </Button>
        )}
      </div>
    </motion.div>
  )
}

export function ErrorState({ error, onRetry, retrying }: { error: FeedError | Error; onRetry: () => void; retrying: boolean }) {
  const kind = (error as FeedError).kind
  const Icon = kind === 'offline' ? WifiOff : ServerCrash
  const title =
    kind === 'offline'
      ? 'You are offline'
      : kind === 'timeout'
        ? 'The USGS feed is slow to respond'
        : 'We could not load the feed'
  return (
    <motion.div className="state state-error" role="alert" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="state-icon">
        <Icon size={26} aria-hidden="true" />
      </div>
      <h3>{title}</h3>
      <p>{error.message}</p>
      <div className="state-actions">
        <Button onClick={onRetry} disabled={retrying} icon={<RotateCw size={16} className={retrying ? 'spin' : ''} />}>
          {retrying ? 'Trying again' : 'Try again'}
        </Button>
        <a className="btn btn-ghost btn-md" href="https://earthquake.usgs.gov/earthquakes/map/" target="_blank" rel="noreferrer">
          <span>Open the USGS map</span>
        </a>
      </div>
    </motion.div>
  )
}
