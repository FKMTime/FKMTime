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
    onConfirm: () => void;
    onCancel: () => void;
}

export const ConfirmDialog: FC<ConfirmDialogProps> = ({
    title = "Are you sure?",
    description = "This action cannot be undone.",
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
                <DialogFooter className="flex flex-col md:flex-row mt-3 gap-3">
                    <DialogClose asChild>
                        <Button onClick={onCancel}>Cancel</Button>
                    </DialogClose>
                    <Button variant="destructive" onClick={onConfirm}>
                        Confirm
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
