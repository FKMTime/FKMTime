import { Box, Heading, Text, useToast } from "@chakra-ui/react";
import { useSetAtom } from "jotai";
import { useEffect, useState } from "react";
import { MdLogout } from "react-icons/md";
import { useNavigate } from "react-router-dom";

import RoundedIconButton from "@/Components/RoundedIconButton";
import { competitionAtom } from "@/lib/atoms";
import { getUserInfo, logout } from "@/lib/auth";
import {
    getCompetitionInfo,
    getUpcomingManageableCompetitions,
    importCompetition,
} from "@/lib/competition";
import { WCACompetition } from "@/lib/interfaces";

import CompetitionsAutocomplete from "./Components/CompetitionsAutocomplete";
import CompetitionsList from "./Components/CompetitionsList";

const ImportCompetition = () => {
    const navigate = useNavigate();
    const toast = useToast();
    const userInfo = getUserInfo();
    const [competitions, setCompetitions] = useState<WCACompetition[]>([]);
    const setCompetition = useSetAtom(competitionAtom);

    const handleSubmit = async (wcaId: string) => {
        if (wcaId === "") {
            toast({
                title: "Error",
                description: "Please enter a competition ID",
                variant: "destructive",
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
                variant: "destructive",
            });
        }
    };

    const handleSelect = (competition: WCACompetition | null) => {
        if (!competition) return;
        setCompetitions((prev) => [...prev, competition]);
    };

    const handleLogout = () => {
        logout();
        toast({
            title: "Logged out",
            description: "You have been logged out.",
            
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
                <Box display="flex" gap="5" alignItems="center">
                    <Text display={{ base: "none", md: "block" }}>
                        Hi {userInfo.fullName}
                    </Text>
                    <RoundedIconButton
                        title="Logout"
                        ariaLabel="Logout"
                        onClick={handleLogout}
                        icon={<MdLogout />}
                    />
                </Box>
            </Box>
            {userInfo.isWcaAdmin && (
                <CompetitionsAutocomplete onSelect={handleSelect} />
            )}
            <Box display="flex" flexDirection="column" gap="5">
                {competitions.length > 0 ? (
                    <CompetitionsList
                        competitions={competitions}
                        handleImportCompetition={handleSubmit}
                    />
                ) : (
                    <Heading size="md">
                        You have no upcoming competitions to manage
                    </Heading>
                )}
            </Box>
        </Box>
    );
};

export default ImportCompetition;
