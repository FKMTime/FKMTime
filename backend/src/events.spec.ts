import {
  DEFAULT_MAX_PENALTY,
  eventsData,
  getMaxPenalty,
  isUnofficialEvent,
} from './events';

describe('eventsData', () => {
  it('treats FTO as an official WCA event', () => {
    expect(eventsData.find((event) => event.id === 'fto')).toMatchObject({
      name: 'Face Turning Octahedron',
      shortName: 'FTO',
      useInspection: true,
    });
    expect(isUnofficialEvent('fto')).toBeFalsy();
  });

  it('continues to identify supported unofficial events', () => {
    expect(isUnofficialEvent('mirror')).toBe(true);
  });
});

describe('getMaxPenalty', () => {
  it('caps clock at +14', () => {
    expect(getMaxPenalty('clock')).toBe(14);
  });

  it('falls back to +16 for events without their own cap', () => {
    expect(DEFAULT_MAX_PENALTY).toBe(16);
    expect(getMaxPenalty('333')).toBe(16);
    expect(getMaxPenalty('unknown-event')).toBe(16);
  });
});
