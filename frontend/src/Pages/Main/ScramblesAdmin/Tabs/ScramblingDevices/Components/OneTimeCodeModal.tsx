import { useEffect, useState } from "react";

import { Modal } from "@/Components/Modal";
import { ScramblingDevice } from "@/lib/interfaces";
import { getOneTimeCode } from "@/lib/scramblingDevices";

interface OneTimeCodeModalProps {
    isOpen: boolean;
    onClose: () => void;
    device: ScramblingDevice;
}

const OneTimeCodeModal: React.FC<OneTimeCodeModalProps> = ({
    isOpen,
    onClose,
    device,
}) => {
    const [oneTimeCode, setOneTimeCode] = useState<string>("");

    // A new code each time the dialog opens
    useEffect(() => {
        if (!isOpen) return;
        getOneTimeCode(device.id).then((data) => setOneTimeCode(data.code));
    }, [device.id, isOpen]);

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Enter this code to log in"
        >
            <h2 className="text-lg">{oneTimeCode}</h2>
        </Modal>
    );
};

export default OneTimeCodeModal;
