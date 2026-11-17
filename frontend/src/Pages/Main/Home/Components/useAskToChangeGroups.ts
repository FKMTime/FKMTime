import { useConfirm } from "@/hooks/useConfirm";

/** What each kind of change does to the room's stations */
const DESCRIPTIONS = {
    start: "Stations in this room switch right away.",
    stopGroup:
        "Stations in this room stop accepting results for it right away.",
    stopRoom:
        "Stations in this room have nothing to time until you start a group.",
} as const;

interface AskOptions {
    title: string;
    confirmLabel: string;
    change: keyof typeof DESCRIPTIONS;
}

/** Asks before a room's groups change; true once confirmed */
export const useAskToChangeGroups = () => {
    const confirm = useConfirm();
    return async ({ title, confirmLabel, change }: AskOptions) => {
        try {
            await confirm({
                title,
                description: DESCRIPTIONS[change],
                confirmLabel,
                variant: change === "start" ? "default" : "destructive",
            });
            return true;
        } catch {
            return false;
        }
    };
};
