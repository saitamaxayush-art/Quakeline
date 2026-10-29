/**
 * Shared SVG patterns and filters for the hand-inked look: hatching at several densities,
 * a stipple, and a displacement filter that roughens edges like ink on paper.
 * Rendered once per story, referenced by id everywhere else.
 */
export default function InkDefs() {
  return (
    <svg className="ink-defs" width="0" height="0" aria-hidden="true" focusable="false">
      <defs>
        <pattern id="h-light" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="7" stroke="var(--ink)" strokeWidth="0.9" />
        </pattern>
        <pattern id="h-mid" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
          <line x1="0" y1="0" x2="0" y2="5" stroke="var(--ink)" strokeWidth="1.3" />
        </pattern>
        <pattern id="h-cross" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="5" stroke="var(--ink)" strokeWidth="1.3" />
          <line x1="0" y1="0" x2="5" y2="0" stroke="var(--ink)" strokeWidth="1.1" />
        </pattern>
        <pattern id="h-flat" width="9" height="4" patternUnits="userSpaceOnUse">
          <line x1="0" y1="2" x2="9" y2="2" stroke="var(--ink)" strokeWidth="0.8" />
        </pattern>
        <pattern id="h-stipple" width="6" height="6" patternUnits="userSpaceOnUse">
          <circle cx="1.5" cy="1.5" r="0.9" fill="var(--ink)" />
          <circle cx="4.5" cy="4.2" r="0.7" fill="var(--ink)" />
        </pattern>
        <pattern id="h-ochre" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
          <rect width="6" height="6" fill="var(--ochre)" />
          <line x1="0" y1="0" x2="0" y2="6" stroke="var(--ink)" strokeWidth="0.8" />
        </pattern>
        <filter id="ink-rough" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="7" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="5" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <filter id="brush-edge" x="-10%" y="-20%" width="120%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.012 0.09" numOctaves="3" seed="3" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="38" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
    </svg>
  )
}
