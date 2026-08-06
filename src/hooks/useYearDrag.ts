import { type PointerEvent as ReactPointerEvent, useCallback, useEffect, useRef, useState } from 'react';
import { angleForPoint, normalizeAngle, radiusForPoint } from '../lib/geometry';
import { angleForDayOfYear, dayOfYearForAngle } from '../lib/year';

/**
 * Below this radius from the dial centre a pointer's angle is mostly noise — a
 * degree of travel near the hub is a fraction of a pixel — so the last committed
 * day is held instead. Only reachable by dragging inward off the ring, since the
 * grab target itself is out at ~89.
 */
const MIN_DRAG_RADIUS = 25;

/**
 * Spread onto the knob's grab target. `SVGGraphicsElement` rather than
 * `SVGElement` because that is what carries `getScreenCTM`.
 */
export interface YearDragHandlers {
  onPointerDown: (event: ReactPointerEvent<SVGGraphicsElement>) => void;
  onPointerMove: (event: ReactPointerEvent<SVGGraphicsElement>) => void;
  onPointerUp: (event: ReactPointerEvent<SVGGraphicsElement>) => void;
  onPointerCancel: (event: ReactPointerEvent<SVGGraphicsElement>) => void;
  onLostPointerCapture: (event: ReactPointerEvent<SVGGraphicsElement>) => void;
}

/**
 * Dragging the year knob: screen coordinates in, a day of the year out.
 *
 * The only part of this feature that touches the DOM, and deliberately thin —
 * every decision it makes is a call into `geometry.ts` or `year.ts`, both of which
 * are pure and swept by tests. What is left here is a matrix, an event
 * choreography, and a ref or two.
 *
 * **Grab offset, not absolute angle.** On `pointerdown` it records the angle
 * between the pointer and the knob's current position and holds it for the drag,
 * so the knob does not jump to the finger when grabbed — the hit target is
 * deliberately much larger than the 2-unit knob, and without this a grab near the
 * edge of that target would snap the date up to six days sideways. It also means a
 * tap that never moves produces a zero delta and changes nothing.
 *
 * Wrapping past the New Year seam needs no special case: the offset is applied and
 * the result normalised, so `dayOfYearForAngle` sees an ordinary angle and answers
 * an ordinary day. Nothing accumulates, so nothing can drift — and there is no
 * clamped end for an accumulator to be needed at.
 *
 * `getScreenCTM().inverse()` rather than `getBoundingClientRect` arithmetic,
 * because the dial carries a `translateY(-8%)` in portrait and can be
 * fullscreened; the CTM accounts for both, plus the viewBox letterboxing, and
 * hand-rolled letterbox maths does not. The inverse is cached for the length of
 * the drag — reading it per move can force layout — and re-read on resize or a
 * fullscreen change, the only things that can move the element under a captured
 * pointer.
 */
export function useYearDrag(
  dayOfYear: number,
  total: number,
  onChange: (day: number) => void,
  onCommit?: () => void,
): { dragging: boolean; handlers: YearDragHandlers } {
  const [dragging, setDragging] = useState(false);
  const inverse = useRef<DOMMatrix | null>(null);
  const target = useRef<SVGGraphicsElement | null>(null);
  const pointerId = useRef<number | null>(null);
  const grabOffsetDeg = useRef(0);
  const lastDay = useRef(dayOfYear);
  /** Removes the drag's `touchmove` blocker — see `onPointerDown`. */
  const unblockScroll = useRef<(() => void) | null>(null);

  /** Client coordinates to the dial's own user units. */
  const toLocal = useCallback((clientX: number, clientY: number) => {
    const matrix = inverse.current;
    return matrix === null ? null : new DOMPoint(clientX, clientY).matrixTransform(matrix);
  }, []);

  const readMatrix = useCallback(() => {
    const ctm = target.current?.getScreenCTM() ?? null;
    inverse.current = ctm === null ? null : ctm.inverse();
  }, []);

  // The element's screen box cannot move under a captured pointer except by one
  // of these, both of which are pathological mid-drag — but the failure mode if
  // it did would be the knob silently tracking the wrong angle.
  useEffect(() => {
    if (!dragging) {
      return;
    }
    window.addEventListener('resize', readMatrix);
    document.addEventListener('fullscreenchange', readMatrix);
    return () => {
      window.removeEventListener('resize', readMatrix);
      document.removeEventListener('fullscreenchange', readMatrix);
    };
  }, [dragging, readMatrix]);

  const end = useCallback(
    (event: ReactPointerEvent<SVGGraphicsElement>) => {
      if (pointerId.current !== event.pointerId) {
        return;
      }
      pointerId.current = null;
      inverse.current = null;
      unblockScroll.current?.();
      unblockScroll.current = null;
      setDragging(false);
      onCommit?.();
    },
    [onCommit],
  );

  const handlers: YearDragHandlers = {
    onPointerDown: (event) => {
      // Primary button and primary pointer only: a right-click or a second
      // finger has no business moving the date.
      if (event.button !== 0 || !event.isPrimary) {
        return;
      }

      // `currentTarget` is unset once React finishes dispatching, so it has to be
      // captured synchronously rather than read from a later callback.
      target.current = event.currentTarget;
      readMatrix();
      const local = toLocal(event.clientX, event.clientY);
      if (local === null) {
        return;
      }

      pointerId.current = event.pointerId;
      // Retargets every later event for this pointer here, so a finger that
      // leaves the knob — immediately, given its size — keeps driving the drag.
      event.currentTarget.setPointerCapture(event.pointerId);

      // The grab target's `touch-action: none` should already keep the browser
      // from claiming this gesture as a scroll, but mobile Safari does not
      // honour it on inner SVG elements: ~10px into a drag it decides the
      // finger is scrolling, fires `pointercancel`, and the knob freezes on
      // the first day it reached. Blocking `touchmove` outright is the version
      // every engine respects. Attached synchronously rather than from an
      // effect, because the scroll-versus-drag decision can be made before an
      // effect runs; removed in `end`, so scrolling and pinch-zoom are only
      // ever suppressed while a finger is actually dragging the knob.
      const block = (touch: TouchEvent) => touch.preventDefault();
      unblockScroll.current?.();
      document.addEventListener('touchmove', block, { passive: false });
      unblockScroll.current = () => document.removeEventListener('touchmove', block);
      grabOffsetDeg.current = normalizeAngle(angleForPoint(local) - angleForDayOfYear(dayOfYear, total));
      lastDay.current = dayOfYear;
      setDragging(true);
    },

    onPointerMove: (event) => {
      if (pointerId.current !== event.pointerId) {
        return;
      }

      const local = toLocal(event.clientX, event.clientY);
      if (local === null || radiusForPoint(local) < MIN_DRAG_RADIUS) {
        return;
      }

      const day = dayOfYearForAngle(normalizeAngle(angleForPoint(local) - grabOffsetDeg.current), total);
      if (day !== lastDay.current) {
        lastDay.current = day;
        onChange(day);
      }
    },

    onPointerUp: end,
    onPointerCancel: end,
    // Capture is also lost when the element goes away or the browser takes the
    // pointer for its own gesture; without this the drag state would stick.
    onLostPointerCapture: end,
  };

  return { dragging, handlers };
}
