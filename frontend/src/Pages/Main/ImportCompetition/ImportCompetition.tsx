import { useSetAtom } from "jotai";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/Components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { useToast } from "@/hooks/useToast";
import { competitionAtom } from "@/lib/atoms";
import { getUserInfo, logout } from "@/lib/auth";
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
