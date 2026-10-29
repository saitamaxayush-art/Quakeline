import { forwardRef, useEffect, useId, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { animate, motion, useInView } from 'motion/react'
import { ChevronDown } from 'lucide-react'

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'solid' | 'outline' | 'ghost' | 'light'
  size?: 'sm' | 'md' | 'lg'
  icon?: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button(
  { variant = 'solid', size = 'md', icon, children, className = '', ...rest },
  ref,
) {
  return (
    <button ref={ref} className={`btn btn-${variant} btn-${size} ${className}`} {...rest}>
      {icon && <span className="btn-icon">{icon}</span>}
      {children && <span>{children}</span>}
    </button>
  )
})

interface SegOption<T extends string> {
  value: T
  label: ReactNode
  title?: string
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  id,
}: {
  value: T
  options: SegOption<T>[]
  onChange: (v: T) => void
  label: string
  id: string
}) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={active}
            title={o.title}
            className={`seg-btn ${active ? 'is-active' : ''}`}
            onClick={() => onChange(o.value)}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                className="seg-thumb"
                transition={{ type: 'spring', stiffness: 420, damping: 36 }}
              />
            )}
            <span className="seg-label">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export function Select<T extends string>({
  value,
  onChange,
  options,
  label,
  hideLabel,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
  label: string
  hideLabel?: boolean
}) {
  const id = useId()
  return (
    <div className="field">
      <label htmlFor={id} className={hideLabel ? 'sr-only' : 'field-label'}>
        {label}
      </label>
      <div className="select">
        <select id={id} value={value} onChange={(e) => onChange(e.target.value as T)}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown size={16} aria-hidden="true" />
      </div>
    </div>
  )
}

export function Check({
  checked,
  onChange,
  children,
  hint,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  children: ReactNode
  hint?: string
}) {
  return (
    <label className="check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="check-box" aria-hidden="true">
        <svg viewBox="0 0 16 16">
          <motion.path
            d="M3.5 8.5l3 3 6-7"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="square"
            strokeLinejoin="miter"
            initial={false}
            animate={{ opacity: checked ? 1 : 0, scale: checked ? 1 : 0.6 }}
            style={{ originX: 0.5, originY: 0.5 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          />
        </svg>
      </span>
      <span className="check-text">
        {children}
        {hint && <small>{hint}</small>}
      </span>
    </label>
  )
}

/** Animates from the previous value to the new one whenever it changes. */
export function CountUp({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const prev = useRef(0)
  const inView = useInView(ref, { once: true })

  useEffect(() => {
    if (!inView || !ref.current) return
    const node = ref.current
    const controls = animate(prev.current, value, {
      duration: 1.1,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => {
        node.textContent = v.toLocaleString('en', {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        })
      },
    })
    prev.current = value
    return () => controls.stop()
  }, [value, decimals, inView])

  return <span ref={ref}>{(0).toFixed(decimals)}</span>
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="kbd">{children}</kbd>
}
