import { useScroll } from '@/contexts/ScrollContext'

interface ParallaxCircleProps {
  size?: number
  minScale?: number
  maxScale?: number
  minLineWidth?: number
  maxLineWidth?: number
  transitionDuration?: number
  backgroundColor?: string
  scrollMultiplier?: number
}

export function ParallaxCircle({
  size = 800,
  minScale = 0.3,
  maxScale = 1,
  minLineWidth = 2,
  maxLineWidth = 8,
  transitionDuration = 0.1,
  backgroundColor = 'rgb(9, 9, 11, 0.5)',
  scrollMultiplier = 1,
}: ParallaxCircleProps) {
  const { scrollY } = useScroll()

  // Apply scroll multiplier
  const effectiveScrollY = scrollY * scrollMultiplier

  // Calculate scale based on scroll
  const scaleRange = maxScale - minScale
  const scale = Math.max(minScale, maxScale - (effectiveScrollY / 2000) * scaleRange)

  // Animate line width based on scroll (starts at max, shrinks to min)
  const lineWidthRange = maxLineWidth - minLineWidth
  const lineWidth = maxLineWidth - (effectiveScrollY / 500) * lineWidthRange
  const clampedWidth = Math.max(minLineWidth, lineWidth)

  // Position to center at (0, 0)
  const offset = -size / 2

  return (
    <div
      className="fixed pointer-events-none"
      style={{
        top: `${offset}px`,
        left: `${offset}px`,
        transform: `scale(${scale})`,
        transformOrigin: 'center center',
        transition: `transform ${transitionDuration}s ease-out`,
        willChange: 'transform',
        zIndex: 0,
      }}
    >
      <div
        className="rounded-full relative"
        style={{
          width: `${size}px`,
          height: `${size}px`,
          background: `linear-gradient(
            135deg,
            color-mix(in srgb, black 80%, transparent) 0%,
            color-mix(in srgb, #1B578C 60%, transparent) 50%,
            color-mix(in srgb, #D914CC 40%, transparent) 100%
          )`,
          padding: `${clampedWidth}px`,
          transition: `padding ${transitionDuration}s ease-out`,
          willChange: 'padding',
        }}
      >
        <div
          className="rounded-full w-full h-full"
          style={{
            background: backgroundColor,
          }}
        />
      </div>
    </div>
  )
}
