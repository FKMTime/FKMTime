import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import LoadingPage from "@/Components/LoadingPage";
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { useToast } from "@/hooks/useToast";
import { DecryptedScramble, ScrambleSet } from "@/lib/interfaces";
import {
    decryptScrambles,
    getScrambleSetById,
    unlockScrambleSet,
} from "@/lib/scrambling";
import PageTransition from "@/Pages/PageTransition";

import ScrambleSetHeaderCard from "../Components/ScrambleSetHeaderCard";
import ScramblesList from "./Components/ScramblesList";

const AllScrambles = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { toast } = useToast();
    const [isLocked, setIsLocked] = useState(true);
    const [scrambleSet, setScrambleSet] = useState<ScrambleSet | null>(null);
    const [decryptedScrambles, setDecryptedScrambles] = useState<
        DecryptedScramble[]
    >([]);

    const fetchScrambleSet = useCallback(async () => {
        if (!id) {
            return navigate("/scrambling-device");
        }
        getScrambleSetById(id).then((data) => {
            setScrambleSet(data);
        });
    }, [id, navigate]);

    useEffect(() => {
        fetchScrambleSet();
    }, [fetchScrambleSet]);

    const handleUnlock = async (password: string) => {
        if (!scrambleSet) return;
        const response = await unlockScrambleSet(scrambleSet.id, password);
        if (response.status === 200) {
            toast({
                title: "Unlocked",
                variant: "success",
            });
            setIsLocked(false);
            setDecryptedScrambles(
                decryptScrambles(response.data.scrambles, password)
            );
        } else if (response.status === 403) {
            toast({
                title: "Invalid password",
                variant: "destructive",
            });
        } else {
            toast({
                title: "Something went wrong",
                variant: "destructive",
            });
        }
    };

    if (!scrambleSet) return <LoadingPage />;

    return (
        <PageTransition>
            <div className="flex flex-col gap-4">
                <ScrambleSetHeaderCard
                    scrambleSet={scrambleSet}
                    isLocked={isLocked}
                    handleUnlock={handleUnlock}
                />
                {!isLocked ? (
                    <Card>
                        <CardHeader>
                            <CardTitle>Scrambles</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ScramblesList
                                scrambles={decryptedScrambles}
                                roundId={scrambleSet.roundId}
                            />
                        </CardContent>
                    </Card>
                ) : null}
            </div>
        </PageTransition>
    );
};

export default AllScrambles;
