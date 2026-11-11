import { useState } from "react";

import { Modal } from "@/Components/Modal";
import { useDialogError } from "@/hooks/useDialogError";
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
    const [error, setError] = useDialogError(isOpen);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (newDevice: ScramblingDeviceData) => {
        setIsLoading(true);

        const status = await createScramblingDevice(newDevice);
        if (status === 201) {
            onClose();
        } else {
            setError("Something went wrong");
        }
        setIsLoading(false);
    };

    if (!isOpen) return null;

    return (
        <Modal
            error={error}
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
