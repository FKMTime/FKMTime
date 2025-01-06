import { Box, Heading, Text } from "@chakra-ui/react";
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
        <Modal isOpen={isOpen} onClose={onClose} title="New one time code">
            <Box display="flex" flexDirection="column" gap="5">
                <Text>Enter this code to log in</Text>
                <Heading>{oneTimeCode}</Heading>
            </Box>
        </Modal>
    );
};

export default OneTimeCodeModal;
