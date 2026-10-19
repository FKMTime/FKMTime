import { useSetAtom } from "jotai";
import { LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import LoadingPage from "@/Components/LoadingPage";
import WordmarkHeader from "@/Components/shared/WordmarkHeader";
import { Button } from "@/Components/ui/button";
import { competitionAtom } from "@/lib/atoms";
import { getUserInfo, logout, updateUserInfo } from "@/lib/auth";
import {
    getCompetitionInfo,
    getUpcomingManageableCompetitions,
    importCompetition,
} from "@/lib/competition";
import { WCACompetition } from "@/lib/interfaces";

import CompetitionSearch from "./Components/CompetitionSearch";
import CompetitionsList from "./Components/CompetitionsList";

const ImportCompetition = () => {
    const navigate = useNavigate();
    const userInfo = getUserInfo();
    const [competitions, setCompetitions] = useState<WCACompetition[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [importingId, setImportingId] = useState<string | null>(null);
    const [importError, setImportError] = useState<{
        competitionId: string;
        message: string;
    } | null>(null);
    const setCompetition = useSetAtom(competitionAtom);

    const handleImport = async (wcaId: string) => {
        setImportingId(wcaId);
        setImportError(null);
        const response = await importCompetition(wcaId);
        if (response.status == 200) {
            await updateUserInfo();
            setCompetition(response.data);
            navigate(`/competition/`, {
                state: { importedCompetition: response.data },
            });
            return;
        }
        setImportError({
            competitionId: wcaId,
            message:
                response.status === 400
                    ? "Competition has already been imported"
                    : response.data.message || "Something went wrong",
        });
        setImportingId(null);
    };

    const handleSelect = (competition: WCACompetition) => {
        if (!competitions.some((c) => c.id === competition.id)) {
            setCompetitions((prev) => [...prev, competition]);
        }
    };

    const handleLogout = () => {
        logout();
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
        <div className="flex min-h-screen flex-col">
            <WordmarkHeader
                className="min-h-[62px] border-b bg-card px-4 py-3 sm:px-6"
                trailing={
                    <Button
                        variant="outline"
                        className="h-[38px] border-border px-3 md:h-[38px]"
                        onClick={handleLogout}
                    >
                        <LogOut />
                        Log out
                    </Button>
                }
            >
                <span className="truncate text-[13px] text-muted-foreground">
                    {userInfo.fullName ?? userInfo.username}
                </span>
            </WordmarkHeader>
            <main className="mx-auto flex w-full max-w-[720px] flex-col gap-5 px-4 pb-14 pt-10 sm:px-6">
                <div className="flex flex-col gap-1.5">
                    <h1 className="text-[26px] font-bold tracking-[-0.02em]">
                        Import competition
                    </h1>
                    <p className="text-pretty text-muted-foreground">
                        Pick a competition from the WCA website to set up
                        FKMTime for it. Events, schedule and competitors are
                        imported automatically.
                    </p>
                </div>
                {userInfo.isWcaAdmin && (
                    <CompetitionSearch onSelect={handleSelect} />
                )}
                <section className="flex flex-col gap-2">
                    <h2 className="pl-0.5 text-[13px] font-semibold text-muted-foreground">
                        Your upcoming competitions
                    </h2>
                    <CompetitionsList
                        competitions={competitions}
                        importingId={importingId}
                        error={importError}
                        onImport={handleImport}
                    />
                </section>
            </main>
        </div>
    );
};

export default ImportCompetition;
