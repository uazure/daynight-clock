import { memo } from 'react';
import { angleForHour, sectorPath, toCartesian } from '../lib/geometry';
import {
  isMoment,
  type Marker,
  type MinuteSpan,
  markerSpans,
  momentPhase,
  type NextBoundary,
  type Phase,
  spanPhase,
} from '../lib/markers';
import { VISUAL } from '../lib/visual';

const { markers: MARKERS } = VISUAL;

/** Minutes after midnight → dial angle, via the hour scale the dial is built on. */
const angleForMinuteOfDay = (minutes: number) => angleForHour(minutes / 60);

const wedge = ({ from, to }: MinuteSpan) =>
  sectorPath(MARKERS.inner, MARKERS.outer, angleForMinuteOfDay(from), angleForMinuteOfDay(to));

/** A radial mark across the band at one minute of the day. */
function radial(minutes: number, width: number, opacity = 1) {
  const angle = angleForMinuteOfDay(minutes);
  const from = toCartesian(MARKERS.inner, angle);
  const to = toCartesian(MARKERS.outer, angle);

  return (
    <line
      x1={from.x}
      y1={from.y}
      x2={to.x}
      y2={to.y}
      stroke={MARKERS.accent}
      strokeWidth={width}
      strokeOpacity={opacity}
    />
  );
}

interface Props {
  markers: Marker[];
  /** Whole minutes after the dial zone's midnight. */
  minuteOfDay: number;
  /** What to call out at full strength; `null` only when there are no markers. */
  next: NextBoundary | null;
}

/**
 * The reader's own hours, tinted onto the face between the hour numerals and the
 * hub readout.
 *
 * **One path per phase, not one per span.** Overlapping intervals at the same
 * opacity would composite twice and paint a third, darker band wherever they
 * cross — a shade the reader would try to interpret, meaning nothing. Every span
 * of a phase is a subpath of a single `<path>` instead, so the fill happens once
 * and an overlap is indistinguishable from a single marker. `sectorPath` closes
 * each subpath with `Z` and winds them all the same way, which is what makes the
 * concatenation safe under the default `nonzero` fill rule.
 *
 * Emphasis is opacity throughout — see the `markers` block in `visual.ts` for
 * why one accent hue rather than five colours, and why the band stops short of
 * the numerals.
 */
export const MarkerWedges = memo(function MarkerWedges({ markers, minuteOfDay, next }: Props) {
  if (markers.length === 0) {
    return null;
  }

  // `active` holds only the part of a block in progress that has *elapsed* — the
  // rest of it is `remaining`, which is the loudest thing here and the reason the
  // two are separate paths rather than one.
  const byPhase: Record<Phase, string[]> = { past: [], active: [], upcoming: [] };
  /** now → the end of whatever is in progress: the part still to come. */
  const remaining: string[] = [];
  const moments = [];

  for (const [index, marker] of markers.entries()) {
    if (isMoment(marker)) {
      const opacity = MARKERS.moment[momentPhase(marker.start, minuteOfDay)];
      moments.push(<g key={index}>{radial(marker.start, MARKERS.moment.width, opacity)}</g>);
      continue;
    }

    for (const span of markerSpans(marker)) {
      const phase = spanPhase(span, minuteOfDay);
      if (phase !== 'active') {
        byPhase[phase].push(wedge(span));
        continue;
      }

      // Cut the block in progress *at now* rather than laying the remainder over
      // it: two stacked translucent fills composite to neither of their
      // opacities, so the loudest thing on the dial would have been a shade
      // nothing in `visual.ts` names. Split, the two parts are exactly what they
      // say they are, and the seam between them is where the hour hand is.
      if (minuteOfDay > span.from) {
        byPhase.active.push(wedge({ from: span.from, to: minuteOfDay }));
      }
      remaining.push(wedge({ from: minuteOfDay, to: span.to }));
    }
  }

  return (
    <g>
      {/* Quietest first, so the loud marks are the ones on top. */}
      {(['past', 'upcoming', 'active'] as const).map((phase) =>
        byPhase[phase].length === 0 ? null : (
          <path key={phase} d={byPhase[phase].join(' ')} fill={MARKERS.accent} fillOpacity={MARKERS.wedge[phase]} />
        ),
      )}

      {remaining.length > 0 && (
        <path d={remaining.join(' ')} fill={MARKERS.accent} fillOpacity={MARKERS.wedge.remaining} />
      )}

      {moments}

      {/*
        The next boundary, at full strength across the band. A wedge's own radial
        face already lands on the exact minute, but at these opacities the eye
        cannot find it; this is the mark that says *which* edge the countdown at
        the hub is counting down to.
      */}
      {next && radial(next.at, MARKERS.boundary.width)}
    </g>
  );
});
