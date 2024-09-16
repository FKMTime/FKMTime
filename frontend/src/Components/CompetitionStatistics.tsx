import { Box } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { MdEqualizer, MdPerson } from "react-icons/md";

import StatCard from "@/Components/StatCard";
import { getCompetitionStatistics } from "@/logic/competition";
import { CompetitionStatistics as ICompetitionStatistics } from "@/logic/interfaces";
import { socket } from "@/socket";

interface CompetitionStatisticsProps {
    enableMobile?: boolean;
}

const CompetitionStatistics = ({
    enableMobile,
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

    return (
        <Box
            display={{ base: enableMobile ? "flex" : "none", md: "flex" }}
            flexDirection={{ base: "column", md: "row" }}
            flexWrap="wrap"
            gap={4}
        >
            <StatCard
                title="Total solves"
                stat={statistics?.allAttempts.toString() || "0"}
                icon={<MdEqualizer size={24} />}
            />
            <StatCard
                title="Solves entered manually"
                stat={statistics?.attemptsEnteredManually.toString() || "0"}
                icon={<MdEqualizer size={24} />}
            />
            <StatCard
                title="Scorecards"
                stat={statistics?.scorecardsCount.toString() || "0"}
                icon={<MdEqualizer size={24} />}
            />
            <StatCard
                title="Competitors"
                stat={statistics?.personsCompeted.toString() || "0"}
                icon={<MdPerson size={24} />}
            />
        </Box>
    );
};

export default CompetitionStatistics;
