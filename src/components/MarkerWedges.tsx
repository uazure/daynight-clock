import { memo } from 'react';
import { angleForHour, arcPath, sectorPath, toCartesian } from '../lib/geometry';
import {
  isMoment,
  laneBand,
  laneCount,
  type Marker,
  type MinuteSpan,
  markerLanes,
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

const wedge = ({ from, to }: MinuteSpan, band: { inner: number; outer: number }) =>
  sectorPath(band.inner, band.outer, angleForMinuteOfDay(from), angleForMinuteOfDay(to));

/**
 * The halo for a wedge: open rails along its two arc edges, **not** its radial
 * ends. Stroking the closed sector drew a light box around every interval, and
 * over the night sector the two radial closures read as start/end ticks that
 * nothing put there — the crisp radial marks are `boundary`'s and the moments'
 * to make, at full strength and on purpose.
 */
const rails = ({ from, to }: MinuteSpan, band: { inner: number; outer: number }) => {
  const fromAngle = angleForMinuteOfDay(from);
  const toAngle = angleForMinuteOfDay(to);
  return `${arcPath(band.outer, fromAngle, toAngle)} ${arcPath(band.inner, fromAngle, toAngle)}`;
};

/**
 * A radial mark at one minute of the day, spanning exactly one lane's band.
 *
 * Exactly one, not all of them: the mark belongs to a particular marker, so
 * drawing it any taller than that marker's own wedge would point at a band the
 * instant has nothing to do with.
 *
 * Two lines, not one: the `halo` underline is what keeps the `core` visible
 * over the night sector — the hands' recipe at the hands' proportions. Opacity
 * fades the pair as one, so a past moment is a quiet *mark*, not a dark line
 * that lost its light backing.
 */
function radial(minutes: number, band: { inner: number; outer: number }, width: number, opacity = 1) {
  const angle = angleForMinuteOfDay(minutes);
  const from = toCartesian(band.inner, angle);
  const to = toCartesian(band.outer, angle);
  const ends = { x1: from.x, y1: from.y, x2: to.x, y2: to.y };

  return (
    <g opacity={opacity}>
      <line {...ends} stroke={MARKERS.halo} strokeWidth={width + 2 * MARKERS.edge.width} />
      <line {...ends} stroke={MARKERS.core} strokeWidth={width} />
    </g>
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
 * **Overlapping intervals stack into lanes.** A 30-minute break inside a work
 * block used to be invisible: same ink, and the fill deliberately happens once,
 * so the two read as one wedge. `markerLanes` puts each interval in a lane instead
 * — longest innermost, shorter ones outward — so the break sits on top of the work
 * it interrupts. Radii come from `laneBand`; with no overlaps there is one lane and
 * the band is exactly what it always was.
 *
 * **One path per phase, not one per span.** Two translucent fills of the same
 * phase would composite twice and paint a third, darker shade wherever they cross —
 * one the reader would try to interpret, meaning nothing. Every span of a phase is
 * a subpath of a single `<path>` instead, so the fill happens once. Lanes make that
 * safer rather than less so: subpaths at different radii cannot overlap at all.
 * `sectorPath` closes each subpath with `Z` and winds them all the same way, which
 * is what keeps the concatenation safe under the default `nonzero` fill rule.
 *
 * **Every mark is a core–halo pair.** Wedges fill with `core` over `halo` rails
 * along their two arc edges — rails, not an outline, so the radial faces stay
 * unstroked; see `rails` above. Radial marks are a core line over a halo
 * underline. Over the day sector the dark fill is the mark and the light rails
 * vanish into the face; over night the fill vanishes and the rails are the
 * mark. See the `markers` block in `visual.ts` for why a pair rather than any
 * single colour, and why the band stops short of the numerals.
 *
 * Emphasis is opacity throughout — the fills on `wedge`'s scale, the edges on
 * `edge`'s own, because a hairline needs more opacity than a band to exist at
 * all.
 */
export const MarkerWedges = memo(function MarkerWedges({ markers, minuteOfDay, next }: Props) {
  if (markers.length === 0) {
    return null;
  }

  // `active` holds only the part of a block in progress that has *elapsed* — the
  // rest of it is `remaining`, which is the loudest thing here and the reason the
  // two are separate paths rather than one. Fills and rails travel together:
  // they are the two halves of one mark, at their two opacity scales.
  const byPhase: Record<Phase, { fills: string[]; rails: string[] }> = {
    past: { fills: [], rails: [] },
    active: { fills: [], rails: [] },
    upcoming: { fills: [], rails: [] },
  };
  /** now → the end of whatever is in progress: the part still to come. */
  const remaining: { fills: string[]; rails: string[] } = { fills: [], rails: [] };
  const moments = [];

  const lanes = markerLanes(markers);
  const count = laneCount(lanes);
  /**
   * The band a marker's own marks are drawn in. Moments are not laned, so they
   * take the innermost band — which is where the whole band was before lanes
   * existed, and keeps an instant reading *against* whatever interval contains it.
   */
  const bandFor = (index: number) => laneBand(lanes[index] ?? 0, count);

  for (const [index, marker] of markers.entries()) {
    if (isMoment(marker)) {
      const opacity = MARKERS.moment[momentPhase(marker.start, minuteOfDay)];
      moments.push(<g key={index}>{radial(marker.start, bandFor(index), MARKERS.moment.width, opacity)}</g>);
      continue;
    }

    const band = bandFor(index);
    const add = (target: { fills: string[]; rails: string[] }, span: MinuteSpan) => {
      target.fills.push(wedge(span, band));
      target.rails.push(rails(span, band));
    };
    for (const span of markerSpans(marker)) {
      const phase = spanPhase(span, minuteOfDay);
      if (phase !== 'active') {
        add(byPhase[phase], span);
        continue;
      }

      // Cut the block in progress *at now* rather than laying the remainder over
      // it: two stacked translucent fills composite to neither of their
      // opacities, so the loudest thing on the dial would have been a shade
      // nothing in `visual.ts` names. Split, the two parts are exactly what they
      // say they are, and the seam between them is where the hour hand is.
      if (minuteOfDay > span.from) {
        add(byPhase.active, { from: span.from, to: minuteOfDay });
      }
      add(remaining, { from: minuteOfDay, to: span.to });
    }
  }

  const mark = ({ fills, rails: railPaths }: { fills: string[]; rails: string[] }, phase: Phase | 'remaining') => (
    <>
      {/* Rails under the fill — the halo goes underneath, as everywhere else. */}
      <path
        d={railPaths.join(' ')}
        fill="none"
        stroke={MARKERS.halo}
        strokeWidth={MARKERS.edge.width}
        strokeOpacity={MARKERS.edge[phase]}
        strokeLinecap="round"
      />
      <path d={fills.join(' ')} fill={MARKERS.core} fillOpacity={MARKERS.wedge[phase]} />
    </>
  );

  return (
    <g>
      {/* Quietest first, so the loud marks are the ones on top. */}
      {(['past', 'upcoming', 'active'] as const).map((phase) =>
        byPhase[phase].fills.length === 0 ? null : <g key={phase}>{mark(byPhase[phase], phase)}</g>,
      )}

      {remaining.fills.length > 0 && mark(remaining, 'remaining')}

      {moments}

      {/*
        The next boundary, at full strength — and in the lane of the marker it
        belongs to, so it ends exactly where that marker's wedge does. A wedge's
        own radial face already lands on the exact minute, but at these opacities
        the eye cannot find it; this is the mark that says *which* edge the
        countdown at the hub is counting down to.
      */}
      {next && radial(next.at, bandFor(markers.indexOf(next.marker)), MARKERS.boundary.width)}
    </g>
  );
});
