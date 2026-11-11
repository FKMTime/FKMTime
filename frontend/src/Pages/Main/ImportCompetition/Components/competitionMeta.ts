import { WCACompetition } from "@/lib/interfaces";
import { formatDateRange } from "@/lib/time";
import { regionNameByIso2 } from "@/lib/utils";

/** "18–19 Apr 2026 · Kraków, Poland" */
export const competitionMeta = (competition: WCACompetition) => {
    const place = [competition.city, regionNameByIso2(competition.country_iso2)]
        .filter(Boolean)
        .join(", ");
    return [
        formatDateRange(competition.start_date, competition.end_date),
        place,
    ]
        .filter(Boolean)
        .join(" · ");
};
