import { activityCodeToName } from "@wca/helpers";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import EventIcon from "@/Components/Icons/EventIcon";
import LoadingPage from "@/Components/LoadingPage";
import { Button } from "@/Components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { Input } from "@/Components/ui/input";
import { useToast } from "@/hooks/useToast";
import { DecryptedScramble, ScrambleSet } from "@/lib/interfaces";
import {
    decryptScrambles,
    getScrambleSetById,
    unlockScrambleSet,
} from "@/lib/scrambling";

import ScramblesList from "./Components/ScramblesList";

const AllScrambles = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { toast } = useToast();
    const [isLocked, setIsLocked] = useState(true);
    const [password, setPassword] = useState("");
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

    const handleUnlock = async () => {
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
        <div className="flex flex-col gap-4">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 ">
                        <EventIcon
                            size={20}
                            eventId={scrambleSet.roundId.split("-")[0]}
                            selected
                        />
                        {activityCodeToName(scrambleSet.roundId)} Set{" "}
                        {scrambleSet.set}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {isLocked ? (
                        <div className="flex flex-col gap-3 w-fit">
                            <Input
                                value={password}
                                type="password"
                                autoFocus
                                placeholder="Password"
                                onChange={(e) => setPassword(e.target.value)}
                                autoComplete="off"
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        handleUnlock();
                                    }
                                }}
                            />
                            <Button variant="success" onClick={handleUnlock}>
                                Unlock
                            </Button>
                        </div>
                    ) : null}
                </CardContent>
            </Card>
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
    );
};

export default AllScrambles;
