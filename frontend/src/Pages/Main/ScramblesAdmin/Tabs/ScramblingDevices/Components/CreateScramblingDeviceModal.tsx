import { useState } from "react";

import { Modal } from "@/Components/Modal";
import { useToast } from "@/hooks/useToast";
import { ScramblingDeviceData } from "@/lib/interfaces";
import {
    createScramblingDevice,
    defaultScramblingDevice,
} from "@/lib/scramblingDevices";

import ScramblingDeviceForm from "./ScramblingDeviceForm";

interface CreateScramblingDeviceModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const CreateScramblingDeviceModal = ({
    isOpen,
    onClose,
}: CreateScramblingDeviceModalProps) => {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (newDevice: ScramblingDeviceData) => {
        setIsLoading(true);

        const status = await createScramblingDevice(newDevice);
        if (status === 201) {
            toast({
                title: "Successfully created new device.",
                variant: "success",
            });
            onClose();
        } else {
            toast({
                title: "Error",
                description: "Something went wrong",
                variant: "destructive",
            });
        }
        setIsLoading(false);
    };

    if (!isOpen) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Create scrambling device"
        >
            <ScramblingDeviceForm
                handleSubmit={handleSubmit}
                device={defaultScramblingDevice}
                isLoading={isLoading}
            />
        </Modal>
    );
};

export default CreateScramblingDeviceModal;
