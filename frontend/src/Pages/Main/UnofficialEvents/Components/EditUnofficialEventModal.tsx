import { useState } from "react";
import { Round } from "wcif-helpers";

import { Modal } from "@/Components/Modal";
import ModalActions from "@/Components/ModalActions";
import { Button } from "@/Components/ui/button";
import { useDialogError } from "@/hooks/useDialogError";
import { UnofficialEvent } from "@/lib/interfaces";
import { updateUnofficialEvent } from "@/lib/unofficialEvents";

import RoundsManager from "./RoundsManager";

interface EditUnofficialEventModalProps {
    isOpen: boolean;
    onClose: () => void;
    unofficialEvent: UnofficialEvent;
}

const EditUnofficialEventModal = ({
    isOpen,
    onClose,
    unofficialEvent,
}: EditUnofficialEventModalProps) => {
    const [error, setError] = useDialogError(isOpen);
    const [isLoading, setIsLoading] = useState(false);
    const [rounds, setRounds] = useState<Round[]>(unofficialEvent.wcif.rounds);

    const handleSubmit = async () => {
        setIsLoading(true);
        const roundsToSend = rounds.map((round) => {
            if (round.cutoff?.resultValue === 0) {
                round.cutoff = null;
            }
            return round;
        });
        const eventToSend = {
            ...unofficialEvent,
            wcif: { ...unofficialEvent.wcif, rounds: roundsToSend },
        };
        const status = await updateUnofficialEvent(eventToSend);
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
            title="Edit rounds details"
        >
            <RoundsManager
                selectedEventId={unofficialEvent.eventId}
                rounds={rounds}
                setRounds={setRounds}
            />
            <ModalActions>
                <Button onClick={handleSubmit} disabled={isLoading}>
                    Save
                </Button>
            </ModalActions>
        </Modal>
    );
};

export default EditUnofficialEventModal;
