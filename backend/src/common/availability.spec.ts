import {
  PRACTICE_HOURS,
  appointmentsOverlap,
  buildAvailability,
  describeInstant,
  findFreeSlot,
  hoursSummary,
  wallClockToInstant,
} from './availability';

// Monday 5 October 2026, 07:00 at the practice (BST).
const MONDAY_MORNING = new Date('2026-10-05T06:00:00.000Z');
const ISO = (v: string) => new Date(v).toISOString();

describe('wallClockToInstant', () => {
  it('resolves a summer time through BST', () => {
    expect(wallClockToInstant('2026-07-06', '10:30')?.toISOString()).toBe('2026-07-06T09:30:00.000Z');
  });

  it('resolves a winter time through GMT', () => {
    expect(wallClockToInstant('2026-12-07', '10:30')?.toISOString()).toBe('2026-12-07T10:30:00.000Z');
  });

  it('rejects malformed input', () => {
    expect(wallClockToInstant('06-07-2026', '10:30')).toBeNull();
    expect(wallClockToInstant('2026-07-06', '25:30')).toBeNull();
    expect(wallClockToInstant('2026-07-06', '10:75')).toBeNull();
    expect(wallClockToInstant('not-a-date', '10:30')).toBeNull();
  });
});

describe('hoursSummary', () => {
  it('states exactly the hours the grid enforces', () => {
    expect(hoursSummary()).toBe('Mon-Fri 08:00-18:00, Sat 09:00-13:00');
  });

  it('matches the configured practice hours', () => {
    expect(PRACTICE_HOURS[0]).toBeNull();
    expect(PRACTICE_HOURS[1]).toEqual({ start: '08:00', end: '18:00' });
    expect(PRACTICE_HOURS[6]).toEqual({ start: '09:00', end: '13:00' });
  });
});

describe('buildAvailability', () => {
  it('offers only slots inside opening hours on open days', () => {
    const availability = buildAvailability({ now: MONDAY_MORNING, days: 7 });
    expect(availability.timezone).toBe('Europe/London');

    const monday = availability.days.find((d) => d.date === '2026-10-05');
    expect(monday).toBeDefined();
    expect(monday!.label).toBe('Mon 5 Oct');
    expect(monday!.slots[0]).toEqual({
      start: ISO('2026-10-05T07:00:00.000Z'),
      label: '08:00',
    });
    expect(monday!.slots[monday!.slots.length - 1].label).toBe('17:30');
    expect(monday!.slots).toHaveLength(20);
  });

  it('omits closed days and trims Saturday to its half-day', () => {
    const availability = buildAvailability({ now: MONDAY_MORNING, days: 7 });
    expect(availability.days.map((d) => d.date)).not.toContain('2026-10-11');

    const saturday = availability.days.find((d) => d.date === '2026-10-10');
    expect(saturday).toBeDefined();
    expect(saturday!.slots[0].label).toBe('09:00');
    expect(saturday!.slots[saturday!.slots.length - 1].label).toBe('12:30');
  });

  it('drops slots already taken by an appointment', () => {
    const availability = buildAvailability({
      now: MONDAY_MORNING,
      days: 7,
      busy: [{ startTime: ISO('2026-10-05T08:30:00.000Z'), endTime: ISO('2026-10-05T09:00:00.000Z'), status: 'confirmed' }],
    });
    const labels = availability.days.find((d) => d.date === '2026-10-05')!.slots.map((s) => s.label);
    expect(labels).not.toContain('09:30');
    expect(labels).toContain('09:00');
    expect(labels).toContain('10:00');
  });

  it('drops every slot an overlapping appointment covers', () => {
    const availability = buildAvailability({
      now: MONDAY_MORNING,
      days: 7,
      busy: [{ startTime: ISO('2026-10-05T08:15:00.000Z'), endTime: ISO('2026-10-05T08:45:00.000Z'), status: 'confirmed' }],
    });
    const labels = availability.days.find((d) => d.date === '2026-10-05')!.slots.map((s) => s.label);
    expect(labels).not.toContain('09:00');
    expect(labels).not.toContain('09:30');
    expect(labels).toContain('10:00');
  });

  it('ignores cancelled appointments', () => {
    const availability = buildAvailability({
      now: MONDAY_MORNING,
      days: 7,
      busy: [{ startTime: ISO('2026-10-05T08:30:00.000Z'), endTime: ISO('2026-10-05T09:00:00.000Z'), status: 'cancelled' }],
    });
    const labels = availability.days.find((d) => d.date === '2026-10-05')!.slots.map((s) => s.label);
    expect(labels).toContain('09:30');
  });

  it('drops slots too soon to honour', () => {
    // 07:55 at the practice — the 08:00 slot is inside the 10 minute lead.
    const availability = buildAvailability({ now: new Date('2026-10-05T06:55:00.000Z'), days: 1 });
    const labels = availability.days[0].slots.map((s) => s.label);
    expect(labels[0]).toBe('08:30');
  });

  it('returns a day with no slots when the day is fully booked', () => {
    const availability = buildAvailability({
      now: MONDAY_MORNING,
      days: 1,
      busy: [
        { startTime: ISO('2026-10-05T00:00:00.000Z'), endTime: ISO('2026-10-06T00:00:00.000Z'), status: 'confirmed' },
      ],
    });
    expect(availability.days).toHaveLength(1);
    expect(availability.days[0].slots).toHaveLength(0);
  });
});

describe('findFreeSlot', () => {
  const busy = [
    { startTime: ISO('2026-10-05T08:30:00.000Z'), endTime: ISO('2026-10-05T09:00:00.000Z'), status: 'confirmed' },
  ];
  const opts = { now: MONDAY_MORNING, days: 7, busy };

  it('accepts a real free slot', () => {
    const slot = findFreeSlot(ISO('2026-10-05T10:00:00.000Z'), opts);
    expect(slot).toEqual({ start: ISO('2026-10-05T10:00:00.000Z'), label: '11:00' });
  });

  it('rejects a slot that is taken', () => {
    expect(findFreeSlot(ISO('2026-10-05T08:30:00.000Z'), opts)).toBeNull();
  });

  it('rejects a slot outside opening hours', () => {
    expect(findFreeSlot(ISO('2026-10-05T18:00:00.000Z'), opts)).toBeNull();
  });

  it('rejects a slot on a closed day', () => {
    expect(findFreeSlot(ISO('2026-10-11T09:00:00.000Z'), opts)).toBeNull();
  });

  it('rejects a slot in the past', () => {
    expect(findFreeSlot(ISO('2026-10-05T06:00:00.000Z'), opts)).toBeNull();
  });

  it('rejects a slot off the booking grid', () => {
    expect(findFreeSlot(ISO('2026-10-05T09:15:00.000Z'), opts)).toBeNull();
  });

  it('rejects unparsable input', () => {
    expect(findFreeSlot('tomorrow at noon', opts)).toBeNull();
  });
});

describe('describeInstant', () => {
  it('reads an instant back at the practice', () => {
    expect(describeInstant('2026-10-05T09:30:00.000Z')).toEqual({
      date: '2026-10-05',
      dayLabel: 'Mon 5 Oct',
      time: '10:30',
    });
  });

  it('rejects unparsable input', () => {
    expect(describeInstant('later')).toBeNull();
  });
});

describe('appointmentsOverlap', () => {
  it('detects intersecting windows and ignores disjoint or invalid ones', () => {
    const a = { startTime: ISO('2026-10-05T10:00:00.000Z'), endTime: ISO('2026-10-05T10:30:00.000Z') };
    expect(
      appointmentsOverlap(a, { startTime: ISO('2026-10-05T10:15:00.000Z'), endTime: ISO('2026-10-05T10:45:00.000Z') }),
    ).toBe(true);
    expect(
      appointmentsOverlap(a, { startTime: ISO('2026-10-05T10:30:00.000Z'), endTime: ISO('2026-10-05T11:00:00.000Z') }),
    ).toBe(false);
    expect(appointmentsOverlap(a, { startTime: 'not-a-date', endTime: 'not-a-date' })).toBe(false);
  });
});
