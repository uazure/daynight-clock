import { describe, expect, it } from 'vitest'
import { angleForHour, sectorPath, toCartesian } from './geometry'

const close = (a: number, b: number) => expect(a).toBeCloseTo(b, 9)

describe('angleForHour', () => {
  it('puts noon at the top and midnight at the bottom', () => {
    close(angleForHour(12), 0)
    close(angleForHour(0), -180)
    close(angleForHour(24), 180)
  })

  it('advances 15 degrees per hour', () => {
    close(angleForHour(18), 90)
    close(angleForHour(6), -90)
    close(angleForHour(13.5), 22.5)
  })
})

describe('toCartesian', () => {
  it('maps 0 degrees to straight up in SVG coordinates', () => {
    const p = toCartesian(100, 0)
    close(p.x, 0)
    close(p.y, -100)
  })

  it('turns clockwise on screen as the angle grows', () => {
    const right = toCartesian(100, 90)
    close(right.x, 100)
    close(right.y, 0)

    const down = toCartesian(100, 180)
    close(down.x, 0)
    close(down.y, 100)
  })

  it('preserves the radius', () => {
    const p = toCartesian(37, 123)
    close(Math.hypot(p.x, p.y), 37)
  })
})

describe('sectorPath', () => {
  it('starts an annular wedge at the outer edge of the start angle', () => {
    const d = sectorPath(50, 100, 0, 30)
    const start = toCartesian(100, 0)
    expect(d.startsWith(`M ${start.x.toFixed(4)} ${start.y.toFixed(4)}`)).toBe(true)
    expect(d.endsWith('Z')).toBe(true)
  })

  it('mentions both radii in an annular wedge', () => {
    const d = sectorPath(50, 100, 0, 30)
    expect(d).toContain('A 100 100')
    expect(d).toContain('A 50 50')
  })

  it('emits a pie slice through the origin when the inner radius is zero', () => {
    const d = sectorPath(0, 100, 0, 30)
    expect(d.startsWith('M 0 0')).toBe(true)
    expect(d).toContain('A 100 100')
    expect(d).not.toContain('A 0 0')
  })

  it('sets the large-arc flag only past 180 degrees', () => {
    expect(sectorPath(0, 100, 0, 179)).toContain('A 100 100 0 0 1')
    expect(sectorPath(0, 100, 0, 181)).toContain('A 100 100 0 1 1')
  })
})
