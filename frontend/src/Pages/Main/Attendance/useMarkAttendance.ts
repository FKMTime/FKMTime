import { useToast } from "@/hooks/useToast";
import { useUndoToast } from "@/hooks/useUndoToast";
import {
    attendanceState,
    markAsAbsent,
    markAsLate,
    markAsPresent,
    restoreAttendance,
} from "@/lib/attendance";
import { StaffActivity, StaffActivityStatus } from "@/lib/interfaces";

type MarkableStatus = Exclude<
    StaffActivityStatus,
    StaffActivityStatus.REPLACED
>;

const MARK_AS: Record<MarkableStatus, (id: string) => Promise<number>> = {
    [StaffActivityStatus.PRESENT]: markAsPresent,
    [StaffActivityStatus.ABSENT]: markAsAbsent,
    [StaffActivityStatus.LATE]: markAsLate,
};

const isSuccess = (status: number) => status === 200 || status === 201;

/**
 * Change a staff member's attendance at once, and offer Undo, which puts the
 * previous status and tags back.
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

    /** Run any change to one row; the toast reads "<name> <done>" */
    const change = async (
        id: string,
        action: () => Promise<number>,
        done: string,
        { canUndo = true } = {}
    ) => {
        const activity = attendance.find((a) => a.id === id);
        if (!isSuccess(await action())) return showError();
        refresh();
        if (!activity || !canUndo) return;
        const previous = attendanceState(activity);
        showUndo({
            title: `${activity.person.name} ${done}`,
            onUndo: async () => {
                if (!isSuccess(await restoreAttendance(id, previous)))
                    return showError();
                refresh();
            },
        });
    };

    const markOne = (
        next: MarkableStatus,
        id: string,
        label: string,
        options: { canUndo?: boolean } = {}
    ) => change(id, () => MARK_AS[next](id), `marked ${label}`, options);

    /** Mark several at once; one Undo puts each previous state back */
    const markMany = async (
        next: MarkableStatus,
        ids: string[],
        label: string
    ) => {
        const activities = attendance.filter((a) => ids.includes(a.id));
        const statuses = await Promise.all(
            activities.map((a) => MARK_AS[next](a.id))
        );
        refresh();
        if (!statuses.every(isSuccess)) return showError();
        showUndo({
            title: `${activities.length} marked ${label}`,
            onUndo: async () => {
                const undone = await Promise.all(
                    activities.map((a) =>
                        restoreAttendance(a.id, attendanceState(a))
                    )
                );
                refresh();
                if (!undone.every(isSuccess)) showError();
            },
        });
    };

    return { change, markOne, markMany };
};
