import { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";

interface ModalProps {
    onClose: () => void;
    isOpen: boolean;
    title: string;
    children: ReactNode;
    className?: string;
}

export const Modal = ({
    onClose,
    isOpen,
    title,
    children,
    className,
}: ModalProps) => {
    return (
        <>
            <Dialog open={isOpen} onOpenChange={onClose}>
                <DialogContent className={cn("pb-3", className)}>
                    <DialogHeader>
                        <DialogTitle>{title}</DialogTitle>
                    </DialogHeader>
                    {children}
                </DialogContent>
            </Dialog>
        </>
    );
};
