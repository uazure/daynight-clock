import type { KeyboardEvent, RefObject } from 'react';
import { dayForKey, formatDayOfYear } from '../lib/year';

interface Props {
  ref: RefObject<HTMLInputElement | null>;
  year: number;
  dayOfYear: number;
  total: number;
  onChange: (day: number) => void;
  onFocusVisibleChange: (visible: boolean) => void;
}

/**
 * The year knob's real control: a native range input, visually hidden, sitting
 * beside the dial in the DOM.
 *
 * WHY NOT `role="slider"` ON THE KNOB ITSELF: the `<svg>` is `role="img"`, which
 * makes its whole subtree presentational — a focusable descendant is not reliably
 * exposed, worst of all in Safari with VoiceOver. Dropping that role to fix it
 * would leak all 1440 ring slices and every bare numeral (`0`, `12`, `05`,
 * `Wake`) into the accessibility tree and duplicate the composed label the dial
 * depends on. See `Clock`, which states that premise outright.
 *
 * So the graphics stay presentational and the control lives out here, where a
 * native input gives us the slider role, focus handling, arrow-key stepping and —
 * the part that matters most — **automatic announcement of the value on change,
 * with no live region to double-announce anything**.
 *
 * The one cost is that focus is invisible on a 1px control, so the ring is drawn
 * on the knob instead; `onFocusVisibleChange` is how it gets there, and
 * `:focus-visible` rather than `:focus` is what keeps it off after a mouse drag.
 */
export function YearSlider({ ref, year, dayOfYear, total, onChange, onFocusVisibleChange }: Props) {
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const next = dayForKey(event.key, event.shiftKey, dayOfYear, year);
    if (next === null) {
      // Not ours — leave Tab, Escape and the browser's own shortcuts alone.
      return;
    }
    // Every step key is intercepted, including the arrows a range would handle
    // itself: the native ones clamp at both ends, and this scale wraps. PageUp
    // would otherwise move by a tenth of the range rather than by a month.
    event.preventDefault();
    onChange(next);
  };

  return (
    <input
      ref={ref}
      type="range"
      className="sr-only"
      min={1}
      max={total}
      step={1}
      value={dayOfYear}
      aria-label="Date for the day and night shading"
      // Without this the value is announced as "216" rather than "4 August".
      // `min`/`max`/`value` already carry the numbers, so no `aria-valuenow`.
      aria-valuetext={formatDayOfYear(year, dayOfYear)}
      onChange={(event) => onChange(Number(event.currentTarget.value))}
      onKeyDown={onKeyDown}
      onFocus={(event) => onFocusVisibleChange(event.currentTarget.matches(':focus-visible'))}
      onBlur={() => onFocusVisibleChange(false)}
    />
  );
}
