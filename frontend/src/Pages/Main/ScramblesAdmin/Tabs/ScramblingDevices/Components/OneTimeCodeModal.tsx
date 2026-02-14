/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useState } from "react";

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

    const generateOneTimeCode = useCallback(async () => {
        if (!isOpen) return;
        const data = await getOneTimeCode(device.id);
        setOneTimeCode(data.code);
    }, [device.id, isOpen]);

    useEffect(() => {
        generateOneTimeCode();
    }, [generateOneTimeCode, isOpen]);

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
