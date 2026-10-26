/** The parts of a seeded WCIF person the specs pick people by */
export interface WcifPerson {
  registrantId: number;
  countryIso2: string;
  registration: { status: string; eventIds: string[] };
}

export interface WcifLike {
  persons: WcifPerson[];
}

/**
 * Hands out registrant ids of seeded competitors that match what a spec
 * needs, each one once, so specs don't depend on who the dummy WCA
 * generated at which registrant id
 */
export const seededPersonPicker = (wcif: WcifLike) => {
  const taken = new Set<number>();
  return (description: string, matches: (person: WcifPerson) => boolean) => {
    const person = wcif.persons.find(
      (p) =>
        p.registration?.status === 'accepted' &&
        !taken.has(p.registrantId) &&
        matches(p),
    );
    if (!person) {
      throw new Error(
        `The seeded competition has no competitor ${description}`,
      );
    }
    taken.add(person.registrantId);
    return person.registrantId;
  };
};
