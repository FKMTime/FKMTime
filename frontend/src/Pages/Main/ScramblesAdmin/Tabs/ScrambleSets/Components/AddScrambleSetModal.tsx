import { Box, Button, Heading, Text, useToast } from "@chakra-ui/react";
import { Competition as WCIF } from "@wca/helpers";
import { useAtomValue } from "jotai";
import { useRef, useState } from "react";

import { Modal } from "@/Components/Modal";
import { activityCodeToName } from "@/lib/activities";
import { competitionAtom } from "@/lib/atoms";
import { getEventName } from "@/lib/events";
import { addScrambles, validateScrambles } from "@/lib/scramblesImport";
import { numberToLetter } from "@/logic/utils";

import ScrambleSetsValidators from "../../ImportScrambles/Components/ScrambleSetsValidators";

interface AddScrambleSetModalProps {
    isOpen: boolean;
    onClose: () => void;
    lastSet: number;
    roundId: string;
}

const AddScrambleSetModal = ({
    isOpen,
    onClose,
    lastSet,
    roundId,
}: AddScrambleSetModalProps) => {
    const toast = useToast();
    const [wcif, setWcif] = useState<WCIF>();
    const [fileInputKey, setFileInputKey] = useState(0);
    const [preventFromImporting, setPreventFromImporting] = useState(false);
    const competition = useAtomValue(competitionAtom);
    const [warningsList, setWarningsList] = useState<string[]>([]);
    const [errorsList, setErrorsList] = useState<string[]>([]);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleFileUpload = () => {
        clearUploadedScrambles(false);
        const file = inputRef.current?.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = () => {
                const result = reader.result as string;
                const parsedWCIF = JSON.parse(result).wcif;
                if (!parsedWCIF || !competition) return;
                const { warnings, errors } = validateScrambles(
                    parsedWCIF,
                    competition?.wcif,
                    true
                );
                setWarningsList(warnings);
                setErrorsList(errors);
                if (errors.length > 0) {
                    setPreventFromImporting(true);
                }
                setWcif(parsedWCIF);
            };
            reader.readAsText(file);
        }
    };

    const handleAdd = async () => {
        if (!wcif || !competition) return;
        const response = await addScrambles(roundId, wcif, lastSet + 1);
        if (response.status === 201) {
            toast({
                title: "Scrambles imported",
                
            });
            clearUploadedScrambles();
            onClose();
        } else {
            toast({
                title: "Error",
                description: "Something went wrong",
                variant: "destructive",
            });
            toast({
                title: "Error",
                description: response.data.message,
                variant: "destructive",
            });
        }
    };

    const clearUploadedScrambles = (clearInput = true) => {
        setWcif(undefined);
        if (clearInput) setFileInputKey((prev) => prev + 1);
        setPreventFromImporting(false);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Add scramble set">
            <Box display="flex" flexDirection="column" gap="5">
                <Heading size="sm">{activityCodeToName(roundId)}</Heading>
                <ScrambleSetsValidators
                    warnings={warningsList}
                    errors={errorsList}
                />
                <Text>
                    Sets generated for {getEventName(roundId.split("-")[0])}{" "}
                    Round 1 will be added to this round, starting from set{" "}
                    {numberToLetter(lastSet + 1)}.
                </Text>
                <input
                    type="file"
                    onChange={handleFileUpload}
                    id="add-scramble-set"
                    ref={inputRef}
                    key={fileInputKey}
                />
                <Button
                    colorScheme="green"
                    onClick={handleAdd}
                    isDisabled={preventFromImporting}
                >
                    Add
                </Button>
            </Box>
        </Modal>
    );
};

export default AddScrambleSetModal;
