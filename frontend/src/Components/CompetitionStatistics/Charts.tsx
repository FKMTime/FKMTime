import { CompetitionStatistics } from "@/lib/interfaces";

import AttemptsByDeviceChart from "./Charts/AttemptsByDeviceChart";
import DelayChart from "./Charts/DelayChart";
import DNFAndIncidentsRateChart from "./Charts/DNFAndIncidentsRateChart";
import JudgeRankingCard from "./Charts/JudgeRankingCard";
import ScramblerRankingCard from "./Charts/ScramblerRankingCard";
import SingleCompetitorJudgesCard from "./Charts/SingleCompetitorJudgesCard";
import SuspiciousAveragesCard from "./Charts/SuspiciousAveragesCard";

interface ChartsProps {
    statistics: CompetitionStatistics;
}

const Charts = ({ statistics }: ChartsProps) => {
    return (
        <div className="hidden md:flex flex-col gap-4">
            <DNFAndIncidentsRateChart data={statistics.byEventStats} />
            {statistics.byRoundStats.map((day) => (
                <DelayChart key={day.id} data={day} />
            ))}
            <AttemptsByDeviceChart data={statistics.attemptsByDevice} />
            <SuspiciousAveragesCard data={statistics.suspiciousAverages} />
            <SingleCompetitorJudgesCard data={statistics.judgeRanking} />
            <JudgeRankingCard data={statistics.judgeRanking} />
            <ScramblerRankingCard data={statistics.scramblerRanking} />
        </div>
    );
};

export default Charts;
