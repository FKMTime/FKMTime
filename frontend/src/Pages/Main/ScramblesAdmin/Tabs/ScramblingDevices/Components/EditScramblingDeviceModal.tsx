import { useState } from "react";

import { Modal } from "@/Components/Modal";
import { useDialogError } from "@/hooks/useDialogError";
import { ScramblingDevice } from "@/lib/interfaces";
import { updateScramblingDevice } from "@/lib/scramblingDevices";

import ScramblingDeviceForm from "./ScramblingDeviceForm";

interface EditScramblingDeviceModalProps {
    isOpen: boolean;
    onClose: () => void;
    device: ScramblingDevice;
}

const EditScramblingDeviceModal = ({
    isOpen,
    onClose,
    device,
}: EditScramblingDeviceModalProps) => {
    const [error, setError] = useDialogError(isOpen);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (editedDevice: ScramblingDevice) => {
        setIsLoading(true);

        const status = await updateScramblingDevice(editedDevice);
        if (status === 200) {
            onClose();
        } else {
            setError("Something went wrong");
        }
        setIsLoading(false);
    };

    return (
        <Modal
            error={error}
            isOpen={isOpen}
            onClose={onClose}
            title="Edit scrambling device"
        >
            <ScramblingDeviceForm
                handleSubmit={handleSubmit}
                device={device}
                isLoading={isLoading}
            />
        </Modal>
    );
};

export default EditScramblingDeviceModal;
