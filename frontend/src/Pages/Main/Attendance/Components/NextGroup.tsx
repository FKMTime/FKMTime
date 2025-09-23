import { competitionAtom } from "@/lib/atoms";
import { useAtomValue } from "jotai";

const NextGroup = () => {
    const competition = useAtomValue(competitionAtom)
    const getNextGroups = () => {
        const groups = [];
        competition.wcif.schedule.venues.forEach((venue: Venue) => {
            const r = venue.rooms.find((item: WCIFRoom) => item.name === room.name);
            r.activities.forEach((a: Activity) => {
              if (
                new Date(a.startTime).getDay() === endTime.getDay() &&
                new Date(a.startTime).getTime() >= endTime.getTime() &&
                new Date(a.startTime).getTime() <= nextRoundStartTime.getTime() &&
                !a.activityCode.startsWith('other')
              ) {
                nextRoundId = a.activityCode;
                nextRoundStartTime = new Date(a.startTime);
              }
            });
          });    
    }
};

export default NextGroup;