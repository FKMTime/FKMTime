import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import LoadingPage from "@/Components/LoadingPage";
import { useToast } from "@/hooks/useToast";
import {
    DecryptedScramble,
    Room,
    ScrambleSet as IScrambleSet,
} from "@/lib/interfaces";
import {
    decryptScrambles,
    getScrambleSetById,
    getScramblingDeviceRoom,
    unlockScrambleSet,
} from "@/lib/scrambling";
import PageTransition from "@/Pages/PageTransition";

import ScrambleSetHeaderCard from "../Components/ScrambleSetHeaderCard";
import Scrambling from "./Components/Scrambling";

const ScrambleSet = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { toast } = useToast();
    const [isLocked, setIsLocked] = useState(true);
    const [scrambleSet, setScrambleSet] = useState<IScrambleSet | null>(null);
    const [decryptedScrambles, setDecryptedScrambles] = useState<
        DecryptedScramble[]
    >([]);

    const [room, setRoom] = useState<Room | null>(null);

    const fetchScrambleSet = useCallback(async () => {
        if (!id) {
            return navigate("/scrambling-device");
        }
        getScrambleSetById(id).then((data) => {
            setScrambleSet(data);
        });
    }, [id, navigate]);

    const fetchRoom = useCallback(async () => {
        getScramblingDeviceRoom().then((data) => {
            setRoom(data);
        });
    }, []);

    useEffect(() => {
        fetchRoom();
        fetchScrambleSet();
    }, [fetchRoom, fetchScrambleSet]);

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

    if (!scrambleSet || !room) return <LoadingPage />;

    return (
        <PageTransition>
            <div className="flex flex-col gap-4">
                <ScrambleSetHeaderCard
                    scrambleSet={scrambleSet}
                    isLocked={isLocked}
                    handleUnlock={handleUnlock}
                />
                {!isLocked ? (
                    <Scrambling
                        groupId={room.currentGroupId}
                        scrambles={decryptedScrambles}
                    />
                ) : null}
            </div>
        </PageTransition>
    );
};

export default ScrambleSet;
