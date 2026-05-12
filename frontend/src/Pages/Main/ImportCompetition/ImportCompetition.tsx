import { useSetAtom } from "jotai";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import LoadingPage from "@/Components/LoadingPage";
import { Button } from "@/Components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { useToast } from "@/hooks/useToast";
import { competitionAtom } from "@/lib/atoms";
import { getUserInfo, logout, updateUserInfo } from "@/lib/auth";
import {
    getCompetitionInfo,
    getUpcomingManageableCompetitions,
    importCompetition,
} from "@/lib/competition";
import { WCACompetition } from "@/lib/interfaces";
import PageTransition from "@/Pages/PageTransition";

import CompetitionsAutocomplete from "./Components/CompetitionsAutocomplete";
import CompetitionsList from "./Components/CompetitionsList";

const ImportCompetition = () => {
    const navigate = useNavigate();
    const { toast } = useToast();
    const userInfo = getUserInfo();
    const [competitions, setCompetitions] = useState<WCACompetition[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const setCompetition = useSetAtom(competitionAtom);

    const handleSubmit = async (wcaId: string) => {
        if (wcaId === "") {
            toast({
                title: "Error",
                description: "Please enter a competition ID",
                variant: "destructive",
            });
            return;
        }
        setIsLoading(true);
        const response = await importCompetition(wcaId);
        if (response.status == 200) {
            await updateUserInfo();
            setCompetition(response.data);
            navigate(`/competition/`);
        } else if (response.status === 400) {
            toast({
                title: "Error",
                description: "Competition has already been imported",
                variant: "destructive",
            });
        } else {
            toast({
                title: "Error",
                description: response.data.message,
                variant: "destructive",
            });
        }
        setIsLoading(false);
    };

    const handleSelect = (competition: WCACompetition | null) => {
        if (!competition) return;
        if (!competitions.some((c) => c.id === competition.id)) {
            setCompetitions((prev) => [...prev, competition]);
        }
    };

    const handleLogout = () => {
        logout();
        toast({
            title: "Logged out",
            description: "You have been logged out.",
            variant: "success",
        });
        navigate("/auth/login");
    };

    useEffect(() => {
        Promise.all([
            getCompetitionInfo(),
            getUpcomingManageableCompetitions(),
        ]).then(([competitionRes, competitionsData]) => {
            if (competitionRes.status === 200) {
                navigate("/");
            }
            setCompetitions(competitionsData);
            setIsLoading(false);
        });
    }, [navigate]);

    if (!userInfo) {
        navigate("/auth/login");
        return null;
    }

    if (isLoading) {
        return <LoadingPage />;
    }

    return (
        <PageTransition>
            <div className="flex flex-col gap-4">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex justify-between items-center">
                            Import competition from the WCA Website
                            <Button onClick={handleLogout}>Logout</Button>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {userInfo.isWcaAdmin && (
                            <CompetitionsAutocomplete onSelect={handleSelect} />
                        )}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Upcoming Competitions</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {competitions.length > 0 ? (
                            <CompetitionsList
                                competitions={competitions}
                                handleImportCompetition={handleSubmit}
                            />
                        ) : (
                            <p>You have no upcoming competitions to manage</p>
                        )}
                    </CardContent>
                </Card>
            </div>
        </PageTransition>
    );
};

export default ImportCompetition;
