import { useEffect } from "react";

import { Button } from "@/Components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/Components/ui/dialog";
import { socket } from "@/socket";

interface AutoSetupModalProps {
    open: boolean;
    onClose: () => void;
}

export const AutoSetupModal = ({ open, onClose }: AutoSetupModalProps) => {
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (open) {
            socket.emit("autosetup:start");
            interval = setInterval(() => {
                socket.emit("autosetup:start");
            }, 5000);
        }
        return () => {
            clearInterval(interval);
            socket.emit("autosetup:stop");
        };
    }, [open]);

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Auto Setup Devices</DialogTitle>
                    <DialogDescription>
                        The system is now in auto setup mode.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button onClick={onClose}>Stop</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
