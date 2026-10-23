import { useEffect, useState } from "react";

/** An error message for a dialog, cleared whenever the dialog closes */
export const useDialogError = (isOpen: boolean) => {
    const [error, setError] = useState("");
    useEffect(() => {
        if (!isOpen) setError("");
    }, [isOpen]);
    return [error, setError] as const;
};
