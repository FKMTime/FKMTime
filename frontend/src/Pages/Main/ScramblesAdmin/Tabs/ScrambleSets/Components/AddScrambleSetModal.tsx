import { useAtomValue } from "jotai";
import { useMemo, useRef, useState } from "react";
import { Competition as WCIF } from "wcif-helpers";

import { Modal } from "@/Components/Modal";
import ModalActions from "@/Components/ModalActions";
import { Button } from "@/Components/ui/button";
import { Input } from "@/Components/ui/input";
import { Label } from "@/Components/ui/label";
import { useDialogError } from "@/hooks/useDialogError";
import { activityCodeToName } from "@/lib/activities";
import { competitionAtom } from "@/lib/atoms";
import { getEventName } from "@/lib/events";
import {
    addScrambles,
    getScrambleSetsToAdd,
    validateScrambles,
} from "@/lib/scramblesImport";
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
    const [error, setError] = useDialogError(isOpen);
    const [wcif, setWcif] = useState<WCIF>();
    const [fileInputKey, setFileInputKey] = useState(0);
    const [preventFromImporting, setPreventFromImporting] = useState(false);
    const competition = useAtomValue(competitionAtom);
    const [warningsList, setWarningsList] = useState<string[]>([]);
    const [errorsList, setErrorsList] = useState<string[]>([]);
    const inputRef = useRef<HTMLInputElement>(null);
    const eventId = roundId.split("-")[0];
    const setsToAdd = useMemo(
        () => (wcif ? getScrambleSetsToAdd(roundId, wcif, lastSet + 1) : []),
        [wcif, roundId, lastSet]
    );
    const displayedErrors =
        wcif && setsToAdd.length === 0
            ? [
                  ...errorsList,
                  `This file has no scramble sets for ${getEventName(eventId)} Round 1`,
              ]
            : errorsList;

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
        if (setsToAdd.length === 0) return;
        const response = await addScrambles(setsToAdd);
        if (response.status === 201) {
            handleClose();
        } else {
            setError("Something went wrong");
            setError(response.data.message);
        }
    };

    const clearUploadedScrambles = (clearInput = true) => {
        setWcif(undefined);
        if (clearInput) setFileInputKey((prev) => prev + 1);
        setPreventFromImporting(false);
        setWarningsList([]);
        setErrorsList([]);
    };

    // The modal stays mounted while the round changes, so a file uploaded for
    // one round must not survive into the next opening.
    const handleClose = () => {
        clearUploadedScrambles();
        onClose();
    };

    return (
        <Modal
            error={error}
            isOpen={isOpen}
            onClose={handleClose}
            title={`Add scramble set for ${activityCodeToName(roundId)}`}
        >
            <div className="flex flex-col gap-3">
                <p>
                    Sets generated for {getEventName(eventId)} Round 1 will be
                    added to this round, starting from set{" "}
                    {numberToLetter(lastSet + 1)}.
                </p>
                <ScrambleSetsValidators
                    warnings={warningsList}
                    errors={displayedErrors}
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
                        onClick={handleAdd}
                        disabled={
                            preventFromImporting || setsToAdd.length === 0
                        }
                    >
                        Add
                    </Button>
                </ModalActions>
            </div>
        </Modal>
    );
};

export default AddScrambleSetModal;
