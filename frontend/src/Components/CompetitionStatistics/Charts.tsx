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

/** Compact stand-in for a chart that would otherwise be a big empty box */
const NotEnoughData = ({ title }: { title: string }) => (
    <section className="flex items-center justify-between gap-3 rounded-2xl border bg-card px-5 py-3.5">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="text-[13px] text-muted-foreground">
            Not enough data yet
        </span>
    </section>
);

const Charts = ({ statistics }: ChartsProps) => {
    return (
        <div className="hidden md:flex flex-col gap-4">
            {statistics.byEventStats.some((event) => event.attempts > 0) ? (
                <DNFAndIncidentsRateChart data={statistics.byEventStats} />
            ) : (
                <NotEnoughData title="DNF and incidents rate" />
            )}
            {statistics.byRoundStats.map((day) =>
                day.roundsStatistics.length >= 2 ? (
                    <DelayChart key={day.id} data={day} />
                ) : (
                    <NotEnoughData
                        key={day.id}
                        title={`Delay for ${new Date(day.date).toLocaleDateString()}`}
                    />
                )
            )}
            {statistics.attemptsByDevice.length > 0 ? (
                <AttemptsByDeviceChart data={statistics.attemptsByDevice} />
            ) : (
                <NotEnoughData title="Attempts by device" />
            )}
            <SuspiciousAveragesCard data={statistics.suspiciousAverages} />
            <SingleCompetitorJudgesCard data={statistics.judgeRanking} />
            <JudgeRankingCard data={statistics.judgeRanking} />
            <ScramblerRankingCard data={statistics.scramblerRanking} />
        </div>
    );
};

export default Charts;
