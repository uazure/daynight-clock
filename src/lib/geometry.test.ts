import { describe, expect, it } from 'vitest';
import {
  angleForHour,
  angleForMinute,
  angleForPoint,
  arcPath,
  normalizeAngle,
  radiusForPoint,
  sectorPath,
  toCartesian,
} from './geometry';

const close = (a: number, b: number) => expect(a).toBeCloseTo(b, 9);

describe('angleForHour', () => {
  it('puts noon at the top and midnight at the bottom', () => {
    close(angleForHour(12), 0);
    close(angleForHour(0), -180);
    close(angleForHour(24), 180);
  });

  it('advances 15 degrees per hour', () => {
    close(angleForHour(18), 90);
    close(angleForHour(6), -90);
    close(angleForHour(13.5), 22.5);
  });
});

describe('angleForMinute', () => {
  it('puts the top of the hour straight up', () => {
    close(angleForMinute(0), 0);
    close(angleForMinute(60), 360);
  });

  it('advances 6 degrees per minute, a full turn per hour', () => {
    close(angleForMinute(15), 90);
    close(angleForMinute(30), 180);
    close(angleForMinute(45), 270);
    close(angleForMinute(10.5), 63);
  });

  it('turns 24 times faster than the hour scale', () => {
    // Both scales share one circle at different rates, which is why the two
    // sets of numerals cannot be told apart by angle — see dial.test.ts.
    close(angleForMinute(60), angleForHour(12 + 24) - angleForHour(12));
  });
});

describe('normalizeAngle', () => {
  it('folds onto [-180, 180), closing the low end', () => {
    // The half-open end is the whole point: straight down has one spelling, and
    // it is the one `angleForHour(0)` produces.
    close(normalizeAngle(-180), -180);
    close(normalizeAngle(180), -180);
    close(normalizeAngle(540), -180);
    close(normalizeAngle(179.9), 179.9);
  });

  it('leaves every hour angle untouched', () => {
    // This identity is what lets an angle read off a pointer be compared with
    // one derived from an hour without either side normalising first.
    for (let hour = 0; hour < 24; hour += 1) {
      close(normalizeAngle(angleForHour(hour)), angleForHour(hour));
    }
  });

  it('wraps in both directions', () => {
    close(normalizeAngle(-190), 170);
    close(normalizeAngle(370), 10);
    close(normalizeAngle(0), 0);
  });
});

describe('angleForPoint', () => {
  it('reads the cardinals on the dial convention', () => {
    // 0 up, growing clockwise, y down — and straight down is -180, not +180.
    close(angleForPoint({ x: 0, y: -10 }), 0);
    close(angleForPoint({ x: 10, y: 0 }), 90);
    close(angleForPoint({ x: 0, y: 10 }), -180);
    close(angleForPoint({ x: -10, y: 0 }), -90);
  });

  it('inverts toCartesian at every angle and radius', () => {
    for (let deg = -180; deg < 180; deg += 1) {
      for (const radius of [1, 88.6, 100]) {
        close(angleForPoint(toCartesian(radius, deg)), deg);
      }
    }
  });

  it('answers a number at the origin rather than NaN', () => {
    // Unreachable in practice — the drag guards on radius first — but a NaN
    // leaking into a day number would be far harder to trace than a 0.
    expect(Number.isNaN(angleForPoint({ x: 0, y: 0 }))).toBe(false);
  });
});

describe('radiusForPoint', () => {
  it('measures distance from the dial centre', () => {
    close(radiusForPoint({ x: 3, y: 4 }), 5);
    close(radiusForPoint({ x: 0, y: 0 }), 0);
    close(radiusForPoint(toCartesian(88.6, 37)), 88.6);
  });
});

describe('toCartesian', () => {
  it('maps 0 degrees to straight up in SVG coordinates', () => {
    const p = toCartesian(100, 0);
    close(p.x, 0);
    close(p.y, -100);
  });

  it('turns clockwise on screen as the angle grows', () => {
    const right = toCartesian(100, 90);
    close(right.x, 100);
    close(right.y, 0);

    const down = toCartesian(100, 180);
    close(down.x, 0);
    close(down.y, 100);
  });

  it('preserves the radius', () => {
    const p = toCartesian(37, 123);
    close(Math.hypot(p.x, p.y), 37);
  });
});

describe('sectorPath', () => {
  it('starts an annular wedge at the outer edge of the start angle', () => {
    const d = sectorPath(50, 100, 0, 30);
    const start = toCartesian(100, 0);
    expect(d.startsWith(`M ${start.x.toFixed(4)} ${start.y.toFixed(4)}`)).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
  });

  it('sets correct sweep flags for both arcs in an annular wedge', () => {
    const d = sectorPath(50, 100, 0, 30);
    expect(d).toContain('A 100 100 0 0 1');
    expect(d).toContain('A 50 50 0 0 0');
  });

  it('emits a pie slice through the origin when the inner radius is zero', () => {
    const d = sectorPath(0, 100, 0, 30);
    expect(d.startsWith('M 0 0')).toBe(true);
    expect(d).toContain('A 100 100');
    expect(d).not.toContain('A 0 0');
  });

  it('sets the large-arc flag only past 180 degrees', () => {
    expect(sectorPath(0, 100, 0, 179)).toContain('A 100 100 0 0 1');
    expect(sectorPath(0, 100, 0, 181)).toContain('A 100 100 0 1 1');
  });
});

describe('arcPath', () => {
  it('runs from the start angle to the end angle at one radius', () => {
    const d = arcPath(100, 0, 30);
    const start = toCartesian(100, 0);
    const end = toCartesian(100, 30);
    expect(d.startsWith(`M ${start.x.toFixed(4)} ${start.y.toFixed(4)}`)).toBe(true);
    expect(d.endsWith(`${end.x.toFixed(4)} ${end.y.toFixed(4)}`)).toBe(true);
  });

  it('stays open — no closure, no radial line', () => {
    // The reason it exists beside `sectorPath`: a closed sector, stroked,
    // outlines its radial faces too, and those read as marks of their own.
    const d = arcPath(100, 0, 30);
    expect(d).not.toContain('Z');
    expect(d).not.toContain('L');
  });

  it('sets the large-arc flag only past 180 degrees', () => {
    expect(arcPath(100, 0, 179)).toContain('A 100 100 0 0 1');
    expect(arcPath(100, 0, 181)).toContain('A 100 100 0 1 1');
  });
});
