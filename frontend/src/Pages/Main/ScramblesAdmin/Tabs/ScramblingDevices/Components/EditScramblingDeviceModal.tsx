import { useToast } from "@chakra-ui/react";
import { useState } from "react";

import { Modal } from "@/Components/Modal";
import { ScramblingDevice } from "@/logic/interfaces";
import { updateScramblingDevice } from "@/logic/scramblingDevices";

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
    const toast = useToast();
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (editedDevice: ScramblingDevice) => {
        setIsLoading(true);

        const status = await updateScramblingDevice(editedDevice);
        if (status === 200) {
            toast({
                title: "Successfully updated this device.",
                status: "success",
            });
            onClose();
        } else {
            toast({
                title: "Error",
                description: "Something went wrong",
                status: "error",
            });
        }
        setIsLoading(false);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Edit scrambling device">
            <ScramblingDeviceForm
                onCancel={onClose}
                onSubmit={handleSubmit}
                device={device}
                isLoading={isLoading}
            />
        </Modal>
    );
};

export default EditScramblingDeviceModal;
