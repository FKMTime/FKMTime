import { Box, Heading, useToast } from "@chakra-ui/react";
import { useSetAtom } from "jotai";
import { useEffect, useState } from "react";
import { MdLogout } from "react-icons/md";
import { useNavigate } from "react-router-dom";

import RoundedIconButton from "@/Components/RoundedIconButton";
import { competitionAtom } from "@/logic/atoms";
import { getUserInfo, logout } from "@/logic/auth";
import {
    getCompetitionInfo,
    getUpcomingManageableCompetitions,
    importCompetition,
} from "@/logic/competition";
import { WCACompetition } from "@/logic/interfaces";

import CompetitionsAutocomplete from "../Competition/Components/CompetitionsAutocomplete";
import CompetitionsList from "./Components/CompetitionsList";

const ImportCompetition = () => {
    const navigate = useNavigate();
    const toast = useToast();
    const userInfo = getUserInfo();
    const [competitions, setCompetitions] = useState<WCACompetition[]>([]);
    const [competitionId, setCompetitionId] = useState<string>("");
    const setCompetition = useSetAtom(competitionAtom);

    const handleSubmit = async (wcaId: string) => {
        if (wcaId === "") {
            toast({
                title: "Error",
                description: "Please enter a competition ID",
                status: "error",
            });
        }
        const response = await importCompetition(wcaId);
        if (response.status === 200) {
            setCompetition(response.data);
            navigate(`/competition/`);
        } else if (response.status === 400) {
            toast({
                title: "Error",
                description: "Competition has already been imported",
                status: "error",
            });
        }
    };

    const handleSelect = (competition: WCACompetition) => {
        setCompetitionId(competition.id);
        setCompetitions((prev) => [...prev, competition]);
    };

    const handleLogout = () => {
        logout();
        toast({
            title: "Logged out",
            description: "You have been logged out.",
            status: "success",
        });
        navigate("/auth/login");
    };

    useEffect(() => {
        getCompetitionInfo().then((res) => {
            if (res.status === 200) {
                navigate("/");
            }
        });
        getUpcomingManageableCompetitions().then((data) => {
            setCompetitions(data);
        });
    }, [navigate]);

    return (
        <Box display="flex" flexDirection="column" gap="5" p={5}>
            <Box display="flex" justifyContent="space-between">
                <Heading size="lg">
                    Import competition from the WCA Website
                </Heading>
                <RoundedIconButton
                    title="Logout"
                    ariaLabel="Logout"
                    onClick={handleLogout}
                    icon={<MdLogout />}
                />
            </Box>
            {userInfo.isWcaAdmin && (
                <CompetitionsAutocomplete
                    onSelect={handleSelect}
                    value={competitionId}
                />
            )}
            <Box display="flex" flexDirection="column" gap="5">
                <CompetitionsList
                    competitions={competitions}
                    handleImportCompetition={handleSubmit}
                />
            </Box>
        </Box>
    );
};

export default ImportCompetition;
