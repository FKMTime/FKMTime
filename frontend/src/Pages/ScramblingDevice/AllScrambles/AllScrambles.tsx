import { Box, Button, Divider, Heading, useToast } from "@chakra-ui/react";
import { activityCodeToName } from "@wca/helpers";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import EventIcon from "@/Components/Icons/EventIcon";
import LoadingPage from "@/Components/LoadingPage";
import PasswordInput from "@/Components/PasswordInput";
import { DecryptedScramble, ScrambleSet } from "@/logic/interfaces";
import {
    decryptScrambles,
    getScrambleSetById,
    unlockScrambleSet,
} from "@/logic/scrambling";

import ScramblesList from "./Components/ScramblesList";

const AllScrambles = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const toast = useToast();
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

    if (!scrambleSet) return <LoadingPage />;

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
                        colorPalette="green"
                        width="fit-content"
                        onClick={handleUnlock}
                    >
                        Unlock
                    </Button>
                </>
            ) : (
                <>
                    <Divider />
                    <ScramblesList
                        scrambles={decryptedScrambles}
                        roundId={scrambleSet.roundId}
                    />
                </>
            )}
        </Box>
    );
};

export default AllScrambles;
