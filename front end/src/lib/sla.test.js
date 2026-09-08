import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAvatarColor, getInitials, getSlaState } from './sla.js';

describe('conversation presentation helpers', () => {
  afterEach(() => vi.useRealTimers());

  it('computes SLA state from the last activity time', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-11T10:00:00.000Z'));

    expect(getSlaState('2026-08-11T09:50:00.000Z').label).toBe('On track');
    expect(getSlaState('2026-08-11T09:30:00.000Z').label).toBe('Due soon');
    expect(getSlaState('2026-08-11T08:00:00.000Z').label).toBe('Breached');
    expect(getSlaState(null).label).toBe('No activity');
  });

  it('creates stable initials and avatar colors', () => {
    expect(getInitials('Mrutyunjaya Pradhan')).toBe('MP');
    expect(getInitials('Greeto')).toBe('G');
    expect(getInitials('')).toBe('?');
    expect(getAvatarColor('workspace-1')).toEqual(getAvatarColor('workspace-1'));
  });
});
