import { useToast } from "@/hooks/useToast";
import { useUndoToast } from "@/hooks/useUndoToast";
import {
    markAsAbsent,
    markAsLate,
    markAsPresent,
    markAsPresentButReplaced,
} from "@/lib/attendance";
import { StaffActivity, StaffActivityStatus } from "@/lib/interfaces";

const MARK_AS: Record<StaffActivityStatus, (id: string) => Promise<number>> = {
    [StaffActivityStatus.PRESENT]: markAsPresent,
    [StaffActivityStatus.ABSENT]: markAsAbsent,
    [StaffActivityStatus.LATE]: markAsLate,
    [StaffActivityStatus.REPLACED]: markAsPresentButReplaced,
};

/**
 * Change a staff member's status at once, and offer Undo, which puts the
 * previous status back.
 */
export const useMarkAttendance = (
    attendance: StaffActivity[],
    refresh: () => void
) => {
    const { toast } = useToast();
    const showUndo = useUndoToast();

    const showError = () =>
        toast({
            title: "Error",
            description: "Something went wrong",
            variant: "destructive",
        });

    const markOne = async (
        next: StaffActivityStatus,
        id: string,
        label: string,
        { canUndo = true } = {}
    ) => {
        const activity = attendance.find((a) => a.id === id);
        if ((await MARK_AS[next](id)) !== 201) return showError();
        refresh();
        if (!activity || !canUndo) return;
        const previous = activity.status;
        showUndo({
            title: `${activity.person.name} marked ${label}`,
            onUndo: async () => {
                if ((await MARK_AS[previous](id)) !== 201) return showError();
                refresh();
            },
        });
    };

    /** Mark several at once; one Undo puts each previous status back */
    const markMany = async (
        next: StaffActivityStatus,
        ids: string[],
        label: string
    ) => {
        const activities = attendance.filter((a) => ids.includes(a.id));
        const statuses = await Promise.all(
            activities.map((a) => MARK_AS[next](a.id))
        );
        refresh();
        if (statuses.some((status) => status !== 201)) return showError();
        showUndo({
            title: `${activities.length} marked ${label}`,
            onUndo: async () => {
                const undone = await Promise.all(
                    activities.map((a) => MARK_AS[a.status](a.id))
                );
                refresh();
                if (undone.some((status) => status !== 201)) showError();
            },
        });
    };

    return { markOne, markMany };
};
