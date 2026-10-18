import { eventsData, isUnofficialEvent } from './events';

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
