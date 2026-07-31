/** Degrees of dial arc per hour: 360° / 24h. */
export const HOUR_ANGLE_DEG = 15
/** Degrees of dial arc per minute: 360° / 60min, one full turn per hour. */
export const MINUTE_ANGLE_DEG = 6

/**
 * Dial angle for an hour of the local day, in degrees.
 * 0° is straight up and angles grow clockwise, so noon sits at the top
 * and midnight at the bottom.
 */
export function angleForHour(hour: number): number {
  return (hour - 12) * HOUR_ANGLE_DEG
}

/**
 * Dial angle for a minute of the hour, in degrees, on the same 0°-is-up
 * clockwise convention. The minute scale turns 24 times faster than the hour
 * scale, so the two share angles — which is why they are drawn on separate
 * rings; see `dial.ts`.
 */
export function angleForMinute(minute: number): number {
  return minute * MINUTE_ANGLE_DEG
}

export interface Point {
  x: number
  y: number
}

/**
 * Polar to SVG-cartesian, with 0° up and positive angles clockwise on screen.
 * Same convention as the original `toDecart`.
 */
export function toCartesian(radius: number, angleDeg: number): Point {
  const rad = (angleDeg * Math.PI) / 180
  return { x: radius * Math.sin(rad), y: -radius * Math.cos(rad) }
}

const fmt = (n: number): string => n.toFixed(4)

/**
 * Path data for a wedge between two radii and two angles.
 * `innerRadius === 0` produces a pie slice through the origin.
 */
export function sectorPath(
  innerRadius: number,
  outerRadius: number,
  startAngleDeg: number,
  endAngleDeg: number,
): string {
  const largeArc = Math.abs(endAngleDeg - startAngleDeg) > 180 ? 1 : 0
  const outerStart = toCartesian(outerRadius, startAngleDeg)
  const outerEnd = toCartesian(outerRadius, endAngleDeg)

  const outerArc =
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ` +
    `${fmt(outerEnd.x)} ${fmt(outerEnd.y)}`

  if (innerRadius === 0) {
    return `M 0 0 L ${fmt(outerStart.x)} ${fmt(outerStart.y)} ${outerArc} Z`
  }

  const innerEnd = toCartesian(innerRadius, endAngleDeg)
  const innerStart = toCartesian(innerRadius, startAngleDeg)

  return (
    `M ${fmt(outerStart.x)} ${fmt(outerStart.y)} ${outerArc} ` +
    `L ${fmt(innerEnd.x)} ${fmt(innerEnd.y)} ` +
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ` +
    `${fmt(innerStart.x)} ${fmt(innerStart.y)} Z`
  )
}
