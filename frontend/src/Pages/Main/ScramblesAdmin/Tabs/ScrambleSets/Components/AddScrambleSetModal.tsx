import { Competition as WCIF } from "@wca/helpers";
import { useAtomValue } from "jotai";
import { useRef, useState } from "react";

import { Modal } from "@/Components/Modal";
import ModalActions from "@/Components/ModalActions";
import { Button } from "@/Components/ui/button";
import { Input } from "@/Components/ui/input";
import { Label } from "@/Components/ui/label";
import { useToast } from "@/hooks/useToast";
import { activityCodeToName } from "@/lib/activities";
import { competitionAtom } from "@/lib/atoms";
import { getEventName } from "@/lib/events";
import { addScrambles, validateScrambles } from "@/lib/scramblesImport";
import { numberToLetter } from "@/lib/utils";

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
    const { toast } = useToast();
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
                variant: "success",
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
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Add scramble set for ${activityCodeToName(roundId)}`}
        >
            <div className="flex flex-col gap-3">
                <p>
                    Sets generated for {getEventName(roundId.split("-")[0])}{" "}
                    Round 1 will be added to this round, starting from set{" "}
                    {numberToLetter(lastSet + 1)}.
                </p>
                <ScrambleSetsValidators
                    warnings={warningsList}
                    errors={errorsList}
                />
                <div className="flex flex-col gap-3 w-fit">
                    <Label htmlFor="add-scramble-set">Upload scrambles</Label>
                    <Input
                        type="file"
                        accept=".json"
                        onChange={handleFileUpload}
                        id="add-scramble-set"
                        ref={inputRef}
                        key={fileInputKey}
                    />
                </div>
                <ModalActions>
                    <Button
                        variant="success"
                        onClick={handleAdd}
                        disabled={preventFromImporting}
                    >
                        Add
                    </Button>
                </ModalActions>
            </div>
        </Modal>
    );
};

export default AddScrambleSetModal;
