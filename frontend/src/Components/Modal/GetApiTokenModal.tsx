import { Modal } from "./Modal.tsx";
import {
    Button,
    Flex,
    IconButton,
    Input,
    Text,
    useToast,
} from "@chakra-ui/react";
import { useState } from "react";
import { MdContentCopy } from "react-icons/md";
import { generateApiToken } from "../../logic/competition.ts";

interface GetApiTokenModalProps {
    isOpen: boolean;
    handleClose: () => void;
}

const GetApiTokenModal = ({ isOpen, handleClose }: GetApiTokenModalProps) => {
    const toast = useToast();
    const [token, setToken] = useState<string>("");

    const handleGetToken = async () => {
        const data = await generateApiToken();
        setToken(data.token);
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(token);
        toast({
            title: "Copied to clipboard",
            status: "success",
            duration: 9000,
            isClosable: true,
        });
    };

    return (
        <Modal onClose={handleClose} isOpen={isOpen} title={"Get API token"}>
            <Flex
                flexDirection="column"
                gap="3"
                textAlign="center"
                justifyContent="center"
            >
                <Text>
                    Click the button below to get the API token. You can only
                    see it once, you have to re-generate it if you lose it.
                </Text>
                <Button colorScheme="green" onClick={handleGetToken}>
                    Get API token
                </Button>
                {token && (
                    <Flex gap="2">
                        <Input type="readonly" value={token} />
                        <IconButton
                            aria-label="Copy token"
                            icon={<MdContentCopy />}
                            onClick={handleCopy}
                        />
                    </Flex>
                )}
            </Flex>
        </Modal>
    );
};

export default GetApiTokenModal;
