/**
 * Practice availability — the single source of truth for when this practice
 * can be booked.
 *
 * Every booking path resolves a wall-clock time through these helpers, so the
 * slot that is offered, the appointment that is stored and the time the
 * visitor reads back are always the same instant. The practice reads its own
 * clock (`PRACTICE_TIMEZONE`), never the server's, so a "09:00" slot stays
 * 09:00 at the practice whatever timezone the host runs in.
 */

export const PRACTICE_TIMEZONE = 'Europe/London';
export const SLOT_MINUTES = 30;
/** A slot starting sooner than this cannot be honoured — drop it. */
export const SLOT_LEAD_MINUTES = 10;
/** How far ahead the booking panel offers free slots. */
export const AVAILABILITY_HORIZON_DAYS = 7;

export type DayHours = { start: string; end: string } | null;

/** Opening hours as wall-clock ranges, indexed by JS day (0 = Sunday). */
export const PRACTICE_HOURS: readonly DayHours[] = [
  null, // Sunday — closed
  { start: '08:00', end: '18:00' },
  { start: '08:00', end: '18:00' },
  { start: '08:00', end: '18:00' },
  { start: '08:00', end: '18:00' },
  { start: '08:00', end: '18:00' },
  { start: '09:00', end: '13:00' },
];

/** A stored appointment, as availability needs to see it. */
export interface BusyAppointment {
  startTime: string;
  endTime: string;
  status?: string | null;
}

export interface SlotOption {
  /** ISO instant the appointment would start at. */
  start: string;
  /** Wall-clock time at the practice, e.g. `09:30`. */
  label: string;
}

export interface DayAvailability {
  /** Practice-local calendar date, `YYYY-MM-DD`. */
  date: string;
  /** Practice-local day heading, e.g. `Mon 5 Oct`. */
  label: string;
  slots: SlotOption[];
}

export interface Availability {
  timezone: string;
  slotMinutes: number;
  days: DayAvailability[];
}

const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const CANCELLED_STATUSES = new Set(['cancelled', 'canceled']);

const zonedPartsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: PRACTICE_TIMEZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

/** Offset (ms) between UTC and the practice clock at `at`. */
function practiceOffsetMs(at: Date): number {
  const parts: Record<string, string> = {};
  for (const part of zonedPartsFormatter.formatToParts(at)) {
    parts[part.type] = part.value;
  }
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/**
 * Convert a practice-local wall clock (`YYYY-MM-DD` + `HH:MM`) to the instant
 * it represents. The second pass re-reads the offset at the resolved instant
 * so the hour either side of a DST change lands on the right side of it.
 */
export function wallClockToInstant(date: string, time: string): Date | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!dateMatch || !timeMatch) return null;

  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  if (hour > 23 || minute > 59) return null;

  const naive = Date.parse(
    `${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00Z`,
  );
  if (Number.isNaN(naive)) return null;

  let instant = new Date(naive - practiceOffsetMs(new Date(naive)));
  const secondPass = new Date(naive - practiceOffsetMs(instant));
  if (secondPass.getTime() !== instant.getTime()) instant = secondPass;
  return instant;
}

const zonedTimeFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: PRACTICE_TIMEZONE,
  hourCycle: 'h23',
  hour: '2-digit',
  minute: '2-digit',
});

/** Practice-local calendar date (`YYYY-MM-DD`) for an instant. */
function practiceDateOf(instant: Date): string {
  const parts: Record<string, string> = {};
  for (const part of zonedPartsFormatter.formatToParts(instant)) {
    parts[part.type] = part.value;
  }
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/**
 * How an instant reads at the practice, e.g.
 * `{ date: '2026-10-06', dayLabel: 'Tue 6 Oct', time: '10:30' }` — used to
 * echo a stored appointment back to the visitor in the same clock it was
 * booked in.
 */
export function describeInstant(iso: string): { date: string; dayLabel: string; time: string } | null {
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) return null;
  const date = practiceDateOf(instant);
  return { date, dayLabel: formatDayLabel(date), time: zonedTimeFormatter.format(instant) };
}

/** `YYYY-MM-DD` + `n` days, as calendar arithmetic (never drifts across DST). */
function addCalendarDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Weekday index (0 = Sunday) of a `YYYY-MM-DD` calendar date. */
function weekdayOf(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Practice-local day heading, e.g. `Mon 5 Oct`. */
export function formatDayLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return `${DAY_ABBR[weekdayOf(date)]} ${d} ${MONTH_ABBR[m - 1]}`;
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function fromMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/** Appointments that are neither cancelled nor outside the window. */
function busyWithin(busy: BusyAppointment[], fromMs: number, toMs: number): BusyAppointment[] {
  return busy.filter((b) => {
    if (b.status && CANCELLED_STATUSES.has(b.status.toLowerCase())) return false;
    const start = Date.parse(b.startTime);
    const end = Date.parse(b.endTime);
    if (Number.isNaN(start) || Number.isNaN(end)) return false;
    return overlaps(fromMs, toMs, start, end);
  });
}

/**
 * Free slots over the next `days` days, grouped by practice-local day.
 * Days the practice is closed are omitted; a day that is open but fully
 * booked is returned with an empty `slots` array so the caller can say so.
 */
export function buildAvailability(
  opts: { now?: Date; days?: number; busy?: BusyAppointment[] } = {},
): Availability {
  const now = opts.now ?? new Date();
  const horizonDays = clampDays(opts.days);
  const busy = opts.busy ?? [];
  const nowMs = now.getTime();
  const leadMs = SLOT_LEAD_MINUTES * 60_000;
  const today = practiceDateOf(now);

  const days: DayAvailability[] = [];
  for (let i = 0; i < horizonDays; i++) {
    const date = addCalendarDays(today, i);
    const hours = PRACTICE_HOURS[weekdayOf(date)];
    if (!hours) continue;

    const slots: SlotOption[] = [];
    const from = toMinutes(hours.start);
    const to = toMinutes(hours.end);
    for (let m = from; m + SLOT_MINUTES <= to; m += SLOT_MINUTES) {
      const label = fromMinutes(m);
      const instant = wallClockToInstant(date, label);
      if (!instant) continue;
      const startMs = instant.getTime();
      if (startMs <= nowMs + leadMs) continue;
      const endMs = startMs + SLOT_MINUTES * 60_000;
      if (busyWithin(busy, startMs, endMs).length > 0) continue;
      slots.push({ start: instant.toISOString(), label });
    }

    days.push({ date, label: formatDayLabel(date), slots });
  }

  return { timezone: PRACTICE_TIMEZONE, slotMinutes: SLOT_MINUTES, days };
}

/**
 * The one free slot matching an ISO instant, or null when it is outside
 * opening hours, off the half-hour grid, already taken, in the past, or
 * further away than the horizon.
 */
export function findFreeSlot(
  startIso: string,
  opts: { now?: Date; days?: number; busy?: BusyAppointment[] } = {},
): SlotOption | null {
  const requested = Date.parse(startIso);
  if (Number.isNaN(requested)) return null;
  const availability = buildAvailability(opts);
  for (const day of availability.days) {
    for (const slot of day.slots) {
      if (Date.parse(slot.start) === requested) return slot;
    }
  }
  return null;
}

/** True when an appointment overlaps another appointment's window. */
export function appointmentsOverlap(a: BusyAppointment, b: BusyAppointment): boolean {
  const aStart = Date.parse(a.startTime);
  const aEnd = Date.parse(a.endTime);
  const bStart = Date.parse(b.startTime);
  const bEnd = Date.parse(b.endTime);
  if ([aStart, aEnd, bStart, bEnd].some(Number.isNaN)) return false;
  return overlaps(aStart, aEnd, bStart, bEnd);
}

function clampDays(days?: number): number {
  if (days === undefined || !Number.isFinite(days)) return AVAILABILITY_HORIZON_DAYS;
  return Math.min(Math.max(Math.trunc(days), 1), 14);
}

const SUMMARY_ORDER = [1, 2, 3, 4, 5, 6, 0];

/**
 * Human summary of `PRACTICE_HOURS`, e.g.
 * `Mon-Fri 08:00-18:00, Sat 09:00-13:00`. This is what the settings row and
 * the greeting quote, so the displayed hours cannot drift from the hours the
 * booking grid actually uses.
 */
export function hoursSummary(): string {
  const groups: { days: number[]; hours: DayHours }[] = [];
  for (const day of SUMMARY_ORDER) {
    const hours = PRACTICE_HOURS[day] ?? null;
    const last = groups[groups.length - 1];
    if (last && sameHours(last.hours, hours)) {
      last.days.push(day);
    } else {
      groups.push({ days: [day], hours });
    }
  }

  return groups
    .filter((g) => g.hours !== null)
    .map((g) => {
      const span =
        g.days.length === 1
          ? DAY_ABBR[g.days[0]]
          : `${DAY_ABBR[g.days[0]]}-${DAY_ABBR[g.days[g.days.length - 1]]}`;
      return `${span} ${g.hours!.start}-${g.hours!.end}`;
    })
    .join(', ');
}

function sameHours(a: DayHours, b: DayHours): boolean {
  if (a === null || b === null) return a === b;
  return a.start === b.start && a.end === b.end;
}
