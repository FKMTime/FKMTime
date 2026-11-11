/** An invented account the dummy WCA signs in with `code` */
export interface DummyWcaAccount {
  code: string;
  token: string;
  wcaId: string;
  wcaUserId: number;
  name: string;
}

/** The competition the dummy WCA generates, which the test seed loads */
export interface GeneratedCompetition {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  timezone: string;
  accounts: Record<
    'delegate' | 'organizer' | 'outsider' | 'admin',
    DummyWcaAccount
  >;
}

/** Ask the dummy WCA which competition and accounts it serves */
export const getGeneratedCompetition =
  async (): Promise<GeneratedCompetition> => {
    const response = await fetch(`${process.env.WCA_ORIGIN}/dummy/generated`);
    if (!response.ok) {
      throw new Error(`The dummy WCA answered ${response.status}`);
    }
    return response.json();
  };
