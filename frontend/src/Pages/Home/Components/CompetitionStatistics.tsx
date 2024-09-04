import { Box } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { MdEqualizer, MdPerson } from "react-icons/md";

import StatCard from "@/Components/StatCard";
import { getCompetitionStatistics } from "@/logic/competition";
import { CompetitionStatistics as ICompetitionStatistics } from "@/logic/interfaces";

const CompetitionStatistics = () => {
    const [statistics, setStatistics] = useState<ICompetitionStatistics | null>(
        null
    );

    useEffect(() => {
        getCompetitionStatistics().then((data) => {
            setStatistics(data);
        });
    }, []);

    return (
        <Box
            display={{ base: "none", md: "grid" }}
            flexDirection={{ base: "column", md: "row" }}
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
