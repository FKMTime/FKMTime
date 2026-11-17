import { useConfirm } from "@/hooks/useConfirm";

/** Asks before a room's groups change; true once confirmed */
export const useAskToChangeGroups = () => {
    const confirm = useConfirm();
    return async (
        title: string,
        confirmLabel: string,
        variant: "default" | "destructive" = "default"
    ) => {
        try {
            await confirm({
                title,
                description:
                    "Stations in this room switch to the new groups right away.",
                confirmLabel,
                variant,
            });
            return true;
        } catch {
            return false;
        }
    };
};
