import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

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
    const [scrambleSet, setScrambleSet] = useState<ScrambleSet | null>(null);
    // Kept with the set they belong to: a head-to-head match moving on to
    // another set opens it on this page, locked until its password
    const [unlocked, setUnlocked] = useState<{
        setId: string;
        scrambles: DecryptedScramble[];
    } | null>(null);
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
            setUnlocked({
                setId: scrambleSet.id,
                scrambles: decryptScrambles(response.data.scrambles, password),
            });
        } else {
            setUnlockError(unlockErrorMessage(response.status));
        }
    };

    return {
        scrambleSet,
        /** null until the set is unlocked */
        scrambles:
            unlocked &&
            unlocked.setId === scrambleSet?.id &&
            unlocked.setId === id
                ? unlocked.scrambles
                : null,
        unlock,
        unlockError,
        clearUnlockError: () => setUnlockError(""),
        isUnlocking,
    };
};
