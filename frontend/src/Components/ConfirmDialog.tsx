import { FC } from "react";

import { Button } from "@/Components/ui/button";

import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "./ui/dialog";

interface ConfirmDialogProps {
    title?: string;
    description?: string;
    confirmLabel?: string;
    /** Destructive confirms are red; use "default" for everyday actions */
    variant?: "destructive" | "default";
    onConfirm: () => void;
    onCancel: () => void;
}

export const ConfirmDialog: FC<ConfirmDialogProps> = ({
    title = "Are you sure?",
    description = "This action cannot be undone.",
    confirmLabel = "Confirm",
    variant = "destructive",
    onConfirm,
    onCancel,
}) => {
    return (
        <Dialog open={true} onOpenChange={onCancel}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                </DialogHeader>
                <DialogDescription>{description}</DialogDescription>
                <DialogFooter className="mt-2 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end sm:space-x-0">
                    <DialogClose asChild>
                        <Button variant="outline" onClick={onCancel}>
                            Cancel
                        </Button>
                    </DialogClose>
                    <Button variant={variant} onClick={onConfirm}>
                        {confirmLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
