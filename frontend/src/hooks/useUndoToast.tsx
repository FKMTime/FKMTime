import { ToastAction } from "@/Components/ui/toast";

import { useToast } from "./useToast";

export const UNDO_WINDOW_MS = 8000;

interface UndoToast {
    title: string;
    description?: string;
    onUndo: () => void;
}

/** A toast for an action that already happened, with an Undo button */
export const useUndoToast = () => {
    const { toast } = useToast();
    return ({ title, description, onUndo }: UndoToast) =>
        toast({
            title,
            description,
            duration: UNDO_WINDOW_MS,
            action: (
                <ToastAction altText="Undo" onClick={onUndo}>
                    Undo
                </ToastAction>
            ),
        });
};
