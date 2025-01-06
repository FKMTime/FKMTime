import { ReactNode } from "react";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "./ui/dialog";

interface ModalProps {
    onClose: () => void;
    isOpen: boolean;
    title: string;
    children: ReactNode;
}

export const Modal = ({ onClose, isOpen, title, children }: ModalProps) => {
    return (
        <>
            <Dialog open={isOpen} onOpenChange={onClose}>
                <DialogContent className="pb-3">
                    <DialogHeader>
                        <DialogTitle>{title}</DialogTitle>
                    </DialogHeader>
                    <DialogDescription>{children}</DialogDescription>
                </DialogContent>
            </Dialog>
        </>
    );
};
