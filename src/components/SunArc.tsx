import { memo } from 'react';
import { daylightArcs } from '../lib/dial';
import { angleForHour, sectorPath } from '../lib/geometry';
import type { SunEvents } from '../lib/sun';
import { VISUAL } from '../lib/visual';

const { sunArc } = VISUAL;

/** Inner and outer edge of the band, from its centreline and width. */
const INNER = sunArc.radius - sunArc.width / 2;
const OUTER = sunArc.radius + sunArc.width / 2;

interface Props {
  events: SunEvents;
}

/**
 * Daylight as a band in the corridor just outside the rim: it starts at sunrise
 * and ends at sunset, so its two ends are the dial's answer to the sunrise and
 * sunset times that used to be printed under the clock.
 *
 * Drawn as a filled annular wedge rather than a stroked arc, which is what makes
 * its ends *radial faces* instead of round caps. That matters: a round cap the
 * width of this band would smear each end by about three minutes of dial arc,
 * and the exact instant is the one thing the element exists to state. The faces
 * are also why no separate end-ticks are needed — the band's own ends are the
 * ticks.
 *
 * The spans come from `daylightArcs`, which is where every awkward case lives:
 * polar day and night, a day with only one crossing, and the days near the polar
 * circles where daylight wraps midnight and needs two bands rather than one.
 * Nothing here decides any of that.
 */
export const SunArc = memo(function SunArc({ events }: Props) {
  const spans = daylightArcs(events);

  if (spans === null) {
    // Polar night: no daylight to mark. An empty band is the honest render, and
    // the reader already has a dial shaded dark the whole way round.
    return null;
  }

  if (spans === 'full') {
    // Polar day. Not a 360° `sectorPath`: its single arc command would start and
    // end at the same point and paint nothing at all, so the closed case has to
    // be a circle.
    return <circle r={sunArc.radius} fill="none" stroke={sunArc.color} strokeWidth={sunArc.width} />;
  }

  return (
    <g>
      {spans.map(({ from, to }) => (
        <path
          key={from}
          d={sectorPath(INNER, OUTER, angleForHour(from / 60), angleForHour(to / 60))}
          fill={sunArc.color}
        />
      ))}
    </g>
  );
});
