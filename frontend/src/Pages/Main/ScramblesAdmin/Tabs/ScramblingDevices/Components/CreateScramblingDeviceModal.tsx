import { useToast } from "@chakra-ui/react";
import { useState } from "react";

import { Modal } from "@/Components/Modal";
import { ScramblingDevice } from "@/lib/interfaces";
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
    const toast = useToast();
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (newDevice: ScramblingDevice) => {
        setIsLoading(true);

        const status = await createScramblingDevice(newDevice);
        if (status === 201) {
            toast({
                title: "Successfully created new device.",
                
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
                onCancel={onClose}
                onSubmit={handleSubmit}
                device={defaultScramblingDevice}
                isLoading={isLoading}
            />
        </Modal>
    );
};

export default CreateScramblingDeviceModal;
