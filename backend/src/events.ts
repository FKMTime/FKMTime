//Unofficial events supported by FKMTime are included here as well.
export const eventsData: {
  id: string;
  name: string;
  icon: string;
  useInspection?: boolean;
  isUnofficial?: boolean;
}[] = [
  { id: '333', name: '3x3x3 Cube', icon: 'event-333', useInspection: true },
  { id: '222', name: '2x2x2 Cube', icon: 'event-222', useInspection: true },
  { id: '444', name: '4x4x4 Cube', icon: 'event-444', useInspection: true },
  { id: '555', name: '5x5x5 Cube', icon: 'event-555', useInspection: true },
  { id: '666', name: '6x6x6 Cube', icon: 'event-666', useInspection: true },
  { id: '777', name: '7x7x7 Cube', icon: 'event-777', useInspection: true },
  {
    id: '333bf',
    name: '3x3x3 Blindfolded',
    icon: 'event-333bf',
    useInspection: false,
  },
  {
    id: '333fm',
    name: '3x3x3 Fewest Moves',
    icon: 'event-333fm',
    useInspection: false,
  },
  {
    id: '333oh',
    name: '3x3x3 One-Handed',
    icon: 'event-333oh',
    useInspection: true,
  },
  { id: 'minx', name: 'Megaminx', icon: 'event-minx', useInspection: true },
  { id: 'pyram', name: 'Pyraminx', icon: 'event-pyram', useInspection: true },
  { id: 'clock', name: 'Clock', icon: 'event-clock', useInspection: true },
  { id: 'skewb', name: 'Skewb', icon: 'event-skewb', useInspection: true },
  { id: 'sq1', name: 'Square-1', icon: 'event-sq1', useInspection: true },
  {
    id: '444bf',
    name: '4x4x4 Blindfolded',
    icon: 'event-444bf',
    useInspection: false,
  },
  {
    id: '555bf',
    name: '5x5x5 Blindfolded',
    icon: 'event-555bf',
    useInspection: false,
  },
  {
    id: '333mbf',
    name: '3x3x3 Multi-Blind',
    icon: 'event-333mbf',
    useInspection: false,
  },
  {
    id: 'fto',
    name: 'FTO',
    icon: 'unofficial-fto',
    useInspection: true,
    isUnofficial: true,
  },
  {
    id: 'mirror',
    name: 'Mirror blocks',
    icon: 'unofficial-333_mirror_blocks',
    useInspection: true,
    isUnofficial: true,
  },
];

export const isUnofficialEvent = (eventId: string) => {
  return eventsData.find((event) => event.id === eventId)?.isUnofficial;
};
