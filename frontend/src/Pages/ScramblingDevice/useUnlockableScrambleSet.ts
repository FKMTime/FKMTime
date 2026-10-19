import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useToast } from "@/hooks/useToast";
import { DecryptedScramble, ScrambleSet } from "@/lib/interfaces";
import {
    decryptScrambles,
    getScrambleSetById,
    unlockScrambleSet,
} from "@/lib/scrambling";

const unlockErrorMessage = (status: number) =>
    status === 403 ? "Invalid password" : "Something went wrong";

/** Loads a scramble set and decrypts its scrambles once unlocked */
export const useUnlockableScrambleSet = (id?: string) => {
    const navigate = useNavigate();
    const { toast } = useToast();
    const [scrambleSet, setScrambleSet] = useState<ScrambleSet | null>(null);
    const [scrambles, setScrambles] = useState<DecryptedScramble[] | null>(
        null
    );
    const [unlockError, setUnlockError] = useState("");
    const [isUnlocking, setIsUnlocking] = useState(false);

    useEffect(() => {
        if (!id) {
            navigate("/scrambling-device");
            return;
        }
        getScrambleSetById(id).then(setScrambleSet);
    }, [id, navigate]);

    const unlock = async (password: string) => {
        if (!scrambleSet) return;
        if (!password) {
            setUnlockError("Enter the password");
            return;
        }
        setIsUnlocking(true);
        const response = await unlockScrambleSet(scrambleSet.id, password);
        setIsUnlocking(false);
        if (response.status === 200) {
            setScrambles(decryptScrambles(response.data.scrambles, password));
            toast({ title: "Unlocked", variant: "success" });
        } else {
            setUnlockError(unlockErrorMessage(response.status));
        }
    };

    return {
        scrambleSet,
        /** null until the set is unlocked */
        scrambles,
        unlock,
        unlockError,
        clearUnlockError: () => setUnlockError(""),
        isUnlocking,
    };
};
