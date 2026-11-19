import { useToast } from "@/hooks/useToast";
import { useUndoToast } from "@/hooks/useUndoToast";
import { setNoShow } from "@/lib/attendance";
import { Person } from "@/lib/interfaces";

/**
 * Tag a person as not coming to these groups, or as coming after all, with
 * an Undo that flips it back. Staff are tagged for the day; a competitor
 * (`competitor`) only for the groups given.
 */
export const useNoShow = (refresh: () => void) => {
    const { toast } = useToast();
    const showUndo = useUndoToast();

    const showError = () =>
        toast({
            title: "Error",
            description: "Something went wrong",
            variant: "destructive",
        });

    return async (
        person: Pick<Person, "id" | "name">,
        groupIds: string[],
        noShow: boolean,
        competitor = false
    ) => {
        if ((await setNoShow(person.id, groupIds, noShow, competitor)) !== 201)
            return showError();
        refresh();
        const notComing = competitor ? "not coming" : "not coming today";
        showUndo({
            title: noShow
                ? `${person.name} ${notComing}`
                : `${person.name} coming after all`,
            onUndo: async () => {
                if (
                    (await setNoShow(
                        person.id,
                        groupIds,
                        !noShow,
                        competitor
                    )) !== 201
                )
                    return showError();
                refresh();
            },
        });
    };
};
