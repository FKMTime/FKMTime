import { CompetitionStatistics } from "@/lib/interfaces";

import AttemptsByDeviceChart from "./Charts/AttemptsByDeviceChart";
import DelayChart from "./Charts/DelayChart";
import DNFAndIncidentsRateChart from "./Charts/DNFAndIncidentsRateChart";

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
        </div>
    );
};

export default Charts;
