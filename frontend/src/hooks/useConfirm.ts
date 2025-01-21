import { useContext } from "react";

import {
    ConfirmContext,
    ConfirmContextType,
} from "@/providers/ConfirmProvider";

export const useConfirm = (): ConfirmContextType["confirm"] => {
    const context = useContext(ConfirmContext);
    if (!context) {
        throw new Error("useConfirm must be used within a ConfirmProvider");
    }
    return context.confirm;
};
