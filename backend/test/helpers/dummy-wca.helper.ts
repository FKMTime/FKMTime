import * as fs from 'fs';
import * as path from 'path';
import { DbService } from 'src/db/db.service';

/**
 * The id the dummy WCA knows the seeded competition by: the one in
 * wcif.json. The seed moves the year in the id to the year it runs in.
 */
export const DUMMY_WCA_COMPETITION_ID: string = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../../prisma/seed/wcif.json'), 'utf8'),
).id;

/**
 * Give the seeded competition the id the dummy WCA knows, so WCA sign-in
 * finds it among the user's competitions; returns a function that restores
 * the seeded id
 */
export const useDummyWcaCompetitionId = async (db: DbService) => {
  const { id, wcaId } = await db.competition.findFirst();
  await db.competition.update({
    where: { id },
    data: { wcaId: DUMMY_WCA_COMPETITION_ID },
  });
  return async () => {
    await db.competition.update({ where: { id }, data: { wcaId } });
  };
};
