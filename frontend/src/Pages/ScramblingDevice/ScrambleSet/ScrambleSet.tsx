import { Box, Button, Divider, Heading, useToast } from "@chakra-ui/react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import EventIcon from "@/Components/Icons/EventIcon";
import LoadingPage from "@/Components/LoadingPage";
import PasswordInput from "@/Components/PasswordInput";
import { activityCodeToName } from "@/logic/activities";
import {
    DecryptedScramble,
    Room,
    ScrambleSet as IScrambleSet,
} from "@/logic/interfaces";
import {
    decryptScrambles,
    getScrambleSetById,
    getScramblingDeviceRoom,
    unlockScrambleSet,
} from "@/logic/scrambling";

import Scrambling from "./Components/Scrambling";

const ScrambleSet = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const toast = useToast();
    const [isLocked, setIsLocked] = useState(true);
    const [password, setPassword] = useState("");
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

    const handleUnlock = async () => {
        if (!scrambleSet) return;
        const response = await unlockScrambleSet(scrambleSet.id, password);
        if (response.status === 200) {
            toast({
                title: "Unlocked",
                status: "success",
            });
            setIsLocked(false);
            setDecryptedScrambles(
                decryptScrambles(response.data.scrambles, password)
            );
        } else if (response.status === 403) {
            toast({
                title: "Invalid password",
                status: "error",
            });
        } else {
            toast({
                title: "Something went wrong",
                status: "error",
            });
        }
    };

    if (!scrambleSet || !room) return <LoadingPage />;

    return (
        <Box display="flex" flexDirection="column" gap={3}>
            <Box display="flex" gap={3} alignItems="center">
                <EventIcon
                    size={32}
                    eventId={scrambleSet.roundId.split("-")[0]}
                    selected
                />
                <Heading>
                    {activityCodeToName(scrambleSet.roundId)} Set{" "}
                    {scrambleSet.set}
                </Heading>
            </Box>
            <Heading size="md">
                Current group: {activityCodeToName(room?.currentGroupId || "")}
            </Heading>
            {isLocked ? (
                <>
                    <Box width="fit-content">
                        <PasswordInput
                            value={password}
                            placeholder="Password"
                            onChange={(e) => setPassword(e.target.value)}
                            autoComplete="off"
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    handleUnlock();
                                }
                            }}
                        />
                    </Box>
                    <Button
                        colorScheme="green"
                        width="fit-content"
                        onClick={handleUnlock}
                    >
                        Unlock
                    </Button>
                </>
            ) : (
                <>
                    <Divider />
                    <Scrambling
                        groupId={room.currentGroupId}
                        scrambles={decryptedScrambles}
                    />
                </>
            )}
        </Box>
    );
};

export default ScrambleSet;
