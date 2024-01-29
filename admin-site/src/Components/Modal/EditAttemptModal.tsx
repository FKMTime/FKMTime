import { Box, Button, Checkbox, FormControl, FormLabel, Input, Select, useToast } from "@chakra-ui/react";
import { Modal } from "./Modal";
import { useState } from "react";
import { Attempt } from "../../logic/interfaces";
import { updateAttempt } from "../../logic/attempt";

interface EditAttemptModalProps {
    isOpen: boolean;
    onClose: () => void;
    attempt: Attempt;
}

const EditAttemptModal: React.FC<EditAttemptModalProps> = ({ isOpen, onClose, attempt }): JSX.Element => {
    const toast = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [editedAttempt, setEditedAttempt] = useState<Attempt>(attempt);
    const [shouldResubmitToWcaLive, setShouldResubmitToWcaLive] = useState<boolean>(false);

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        setIsLoading(true);
        event.preventDefault();

        const status = await updateAttempt({
            ...editedAttempt,
            shouldResubmitToWcaLive,
        });
        if (status === 200) {
            toast({
                title: "Successfully updated account.",
                status: "success",
                duration: 9000,
                isClosable: true,
            });
            onClose();
        } else {
            toast({
                title: "Error",
                description: "Something went wrong",
                status: "error",
                duration: 9000,
                isClosable: true,
            });
        }
        setIsLoading(false);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Create Account">
            <Box display="flex" flexDirection="column" gap="5" as="form" onSubmit={handleSubmit}>
                <FormControl isRequired>
                    <FormLabel>Attempt number</FormLabel>
                    <Input placeholder='Attempt number' _placeholder={{ color: "white" }} value={editedAttempt.attemptNumber} disabled={isLoading} onChange={(e) => setEditedAttempt({ ...editedAttempt, attemptNumber: +e.target.value })} />
                </FormControl>
                <FormControl isRequired>
                    <FormLabel>Time</FormLabel>
                    <Input placeholder='Time' _placeholder={{ color: "white" }} value={editedAttempt.value} disabled={isLoading} onChange={(e) => setEditedAttempt({ ...editedAttempt, value: +e.target.value })} />
                </FormControl>
                <FormControl>
                    <FormLabel>Comment</FormLabel>
                    <Input placeholder='Comment' _placeholder={{ color: "white" }} value={editedAttempt.comment} disabled={isLoading} onChange={(e) => setEditedAttempt({ ...editedAttempt, comment: e.target.value })} />
                </FormControl>
                <FormControl>
                    <FormLabel>Penalty</FormLabel>
                    <Select placeholder='Select penalty' _placeholder={{ color: "white" }} value={editedAttempt.penalty} disabled={isLoading} onChange={(e) => setEditedAttempt({ ...editedAttempt, penalty: +e.target.value })}>
                        <option value={0}>No penalty</option>
                        <option value={2}>+2</option>
                        <option value={-1}>DNF</option>
                        <option value={-2}>DNS</option>
                        <option value={4}>+4</option>
                        <option value={6}>+6</option>
                        <option value={8}>+8</option>
                        <option value={10}>+10</option>
                        <option value={12}>+12</option>
                        <option value={14}>+14</option>
                        <option value={16}>+16</option>
                    </Select>
                </FormControl>
                {editedAttempt.extraGiven && (
                    <FormControl>
                        <FormLabel>Replaced by</FormLabel>
                        <Input placeholder='Replaced by' _placeholder={{ color: "white" }} value={editedAttempt.replacedBy} disabled={isLoading} onChange={(e) => setEditedAttempt({ ...editedAttempt, replacedBy: +e.target.value })} />
                    </FormControl>
                )}
                <Checkbox isChecked={editedAttempt.isDelegate} onChange={(e) => setEditedAttempt({ ...editedAttempt, isDelegate: e.target.checked })}>Is delegate case</Checkbox>
                {editedAttempt.isDelegate && (
                    <>
                        <Checkbox isChecked={editedAttempt.isResolved} onChange={(e) => setEditedAttempt({ ...editedAttempt, isResolved: e.target.checked })}>Is resolved</Checkbox>
                        <Checkbox isChecked={editedAttempt.extraGiven} onChange={(e) => setEditedAttempt({ ...editedAttempt, extraGiven: e.target.checked })}>Extra given</Checkbox>
                    </>
                )}
                <Checkbox isChecked={shouldResubmitToWcaLive} onChange={(e) => setShouldResubmitToWcaLive(e.target.checked)}>Resubmit to WCA Live</Checkbox>
                <Box display="flex" flexDirection="row" justifyContent="end" gap="5">
                    {!isLoading && (
                        <Button colorScheme='red' onClick={onClose}>
                            Cancel
                        </Button>
                    )}
                    <Button colorScheme='green' type="submit" isLoading={isLoading}>Save</Button>
                </Box>
            </Box>
        </Modal>
    )
};

export default EditAttemptModal;
