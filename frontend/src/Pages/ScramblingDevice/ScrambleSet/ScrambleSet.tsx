import { Box, Button, Heading, Input, useToast } from "@chakra-ui/react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import LoadingPage from "@/Components/LoadingPage";
import { activityCodeToName } from "@/logic/activities";
import { Scramble, ScrambleSet as IScrambleSet } from "@/logic/interfaces";
import { getScrambleSetById, unlockScrambleSet } from "@/logic/scrambling";

const ScrambleSet = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const toast = useToast();
    const [isLocked, setIsLocked] = useState(true);
    const [password, setPassword] = useState("");
    const [scrambleSet, setScrambleSet] = useState<IScrambleSet | null>(null);
    const [scrambles, setScrambles] = useState<Scramble[] | null>(null);

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
            setScrambles(response.data.scrambles);
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
            <Heading>
                {activityCodeToName(scrambleSet.roundId)} Set {scrambleSet.set}
            </Heading>
            {isLocked ? (
                <>
                    <Input
                        value={password}
                        width="fit-content"
                        placeholder="Password"
                        onChange={(e) => setPassword(e.target.value)}
                        type="password"
                    />
                    <Button
                        colorScheme="green"
                        width="fit-content"
                        onClick={handleUnlock}
                    >
                        Unlock
                    </Button>
                </>
            ) : (
                <Box>Unlocked</Box>
            )}
        </Box>
    );
};

export default ScrambleSet;
