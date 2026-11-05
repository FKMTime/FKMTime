import { useState } from "react";

/** An error message for a dialog, cleared whenever the dialog closes */
export const useDialogError = (isOpen: boolean) => {
    const [error, setError] = useState("");
    const [wasOpen, setWasOpen] = useState(isOpen);
    if (isOpen !== wasOpen) {
        setWasOpen(isOpen);
        if (!isOpen) setError("");
    }
    return [error, setError] as const;
};
