import { ReactNode } from "react";

import InlineError from "@/Components/shared/InlineError";
import { cn } from "@/lib/utils";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";

interface ModalProps {
    onClose: () => void;
    isOpen: boolean;
    title: string;
    children: ReactNode;
    className?: string;
    /** Shown above the content; the dialog stays open so input is kept */
    error?: string;
}

export const Modal = ({
    onClose,
    isOpen,
    title,
    children,
    className,
    error,
}: ModalProps) => {
    return (
        <>
            <Dialog open={isOpen} onOpenChange={onClose}>
                <DialogContent className={cn("pb-3", className)}>
                    <DialogHeader>
                        <DialogTitle>{title}</DialogTitle>
                    </DialogHeader>
                    <InlineError className="text-[13px]">{error}</InlineError>
                    {children}
                </DialogContent>
            </Dialog>
        </>
    );
};
