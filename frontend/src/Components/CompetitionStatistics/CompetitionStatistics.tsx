import { useEffect, useState } from "react";
import { MdEqualizer, MdPerson } from "react-icons/md";

import StatCard from "@/Components/StatCard";
import { getCompetitionStatistics } from "@/lib/competition";
import { CompetitionStatistics as ICompetitionStatistics } from "@/lib/interfaces";
import { cn } from "@/lib/utils";
import { socket } from "@/socket";

import Charts from "./Charts";

interface CompetitionStatisticsProps {
    enableMobile?: boolean;
    showCharts?: boolean;
}

const CompetitionStatistics = ({
    enableMobile,
    showCharts,
}: CompetitionStatisticsProps) => {
    const [statistics, setStatistics] = useState<ICompetitionStatistics | null>(
        null
    );

    const fetchData = () => {
        getCompetitionStatistics().then((data) => {
            setStatistics(data);
        });
    };

    useEffect(() => {
        fetchData();

        socket.emit("joinStatistics");

        socket.on("statisticsUpdated", () => {
            fetchData();
        });

        return () => {
            socket.emit("leaveStatistics");
        };
    }, []);

    if (!statistics) return null;

    if (!showCharts) {
        return (
            <>
                <StatCard
                    title="Total solves"
                    stat={statistics.allAttempts.toString() || "0"}
                    icon={<MdEqualizer size={24} />}
                />
                <StatCard
                    title="Solves entered manually"
                    stat={statistics.attemptsEnteredManually.toString() || "0"}
                    icon={<MdEqualizer size={24} />}
                />
                <StatCard
                    title="Scorecards"
                    stat={statistics.scorecardsCount.toString() || "0"}
                    icon={<MdEqualizer size={24} />}
                />
                <StatCard
                    title="Competitors"
                    stat={statistics.personsCompeted.toString() || "0"}
                    icon={<MdPerson size={24} />}
                />
            </>
        );
    }

    return (
        <div className="mt-2 flex flex-col gap-3">
            <div className="flex gap-3">
                <StatCard
                    title="Total solves"
                    stat={statistics.allAttempts.toString() || "0"}
                    icon={<MdEqualizer size={24} />}
                />
                <StatCard
                    title="Solves entered manually"
                    stat={statistics.attemptsEnteredManually.toString() || "0"}
                    icon={<MdEqualizer size={24} />}
                />
                <StatCard
                    title="Scorecards"
                    stat={statistics.scorecardsCount.toString() || "0"}
                    icon={<MdEqualizer size={24} />}
                />
                <StatCard
                    title="Competitors"
                    stat={statistics.personsCompeted.toString() || "0"}
                    icon={<MdPerson size={24} />}
                />
            </div>
            {showCharts && <Charts statistics={statistics} />}
        </div>
    );
};

export default CompetitionStatistics;
