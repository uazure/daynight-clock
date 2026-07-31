import { memo } from 'react';
import { sampleIndexForHour } from '../lib/dial';
import { angleForHour, toCartesian } from '../lib/geometry';
import { labelInk } from '../lib/lightness';
import { VISUAL } from '../lib/visual';

const { hourLabels } = VISUAL;

interface Props {
  lightness: Float64Array;
}

/**
 * Every second hour, unpadded — the minute band outside the face pads its own
 * numerals, so `0` against `00` says which scale you are reading. Twelve of
 * them leave ~33 units of arc apiece at this radius, so nothing had to shrink
 * to fit; the size is held up by legibility on a phone, not by crowding.
 *
 * Each numeral takes its two tones from the shading at its own angle, which is
 * why this needs the day profile: the tone that contrasts with the face fills
 * the glyph and the other is stroked underneath as a halo. See `hourLabels` in
 * `visual.ts` for why both the flip and the halo are load-bearing.
 */
export const HourLabels = memo(function HourLabels({ lightness }: Props) {
  const labels = [];

  for (let hour = 0; hour < 24; hour += hourLabels.step) {
    const at = toCartesian(hourLabels.radius, angleForHour(hour));
    const ink = labelInk(lightness[sampleIndexForHour(hour)]);

    labels.push(
      <text
        key={hour}
        x={at.x}
        y={at.y}
        fill={ink.fill}
        stroke={ink.outline}
        strokeWidth={hourLabels.outlineWidth}
        strokeLinejoin="round"
        paintOrder="stroke"
        fontSize={hourLabels.size}
        fontWeight={hourLabels.weight}
        textAnchor="middle"
        dominantBaseline="central"
      >
        {hour}
      </text>,
    );
  }

  return <g>{labels}</g>;
});
