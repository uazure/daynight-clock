import { memo } from 'react';
import { sampleIndexForHour } from '../lib/dial';
import { angleForHour, toCartesian } from '../lib/geometry';
import { contrastInk } from '../lib/lightness';
import { VISUAL } from '../lib/visual';

const { ticks: TICKS, hourLabels } = VISUAL;

interface Props {
  lightness: Float64Array;
}

/**
 * Three tiers of emphasis, so the eye has somewhere to land before it starts
 * counting: the quarter-day anchors (midnight, dawn, noon, dusk) are longest
 * and heaviest, the hours carrying a numeral are next, and the remaining hours
 * are hairlines. The middle tier is defined by which hours get a numeral, so it
 * reads `hourLabels.step` rather than repeating the number.
 */
function tierFor(hour: number) {
  if (hour % TICKS.anchorStep === 0) {
    return TICKS.tiers.quarter;
  }
  if (hour % hourLabels.step === 0) {
    return TICKS.tiers.labelled;
  }
  return TICKS.tiers.plain;
}

export const Ticks = memo(function Ticks({ lightness }: Props) {
  const marks = [];

  for (let hour = 0; hour < 24; hour += 1) {
    const { inner, width } = tierFor(hour);
    const angle = angleForHour(hour);
    // Back the outer end off by half the stroke width so the round cap lands on
    // `outer` rather than past it. Drawn to `outer` directly, each tier
    // overshoots by a different amount and the heaviest pokes through the rim.
    const from = toCartesian(TICKS.outer - width / 2, angle);
    const to = toCartesian(inner, angle);

    marks.push(
      <line
        key={hour}
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        stroke={contrastInk(lightness[sampleIndexForHour(hour)])}
        strokeWidth={width}
        strokeLinecap="round"
      />,
    );
  }

  return <g>{marks}</g>;
});
