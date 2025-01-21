import { Round } from "@wca/helpers";
import { useState } from "react";

import { Modal } from "@/Components/Modal";
import ModalActions from "@/Components/ModalActions";
import { Button } from "@/Components/ui/button";
import { useToast } from "@/hooks/useToast";
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
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [rounds, setRounds] = useState<Round[]>(unofficialEvent.wcif.rounds);

    const handleSubmit = async () => {
        setIsLoading(true);
        const roundsToSend = rounds.map((round) => {
            if (round.cutoff?.attemptResult === 0) {
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
            toast({
                title: "Successfully updated unofficial event",
                variant: "success",
            });
            onClose();
        } else {
            toast({
                title: "Error",
                description: "Something went wrong",
                variant: "destructive",
            });
        }
        setIsLoading(false);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Edit rounds details">
            <RoundsManager
                selectedEventId={unofficialEvent.eventId}
                rounds={rounds}
                setRounds={setRounds}
            />
            <ModalActions>
                <Button
                    variant="success"
                    onClick={handleSubmit}
                    disabled={isLoading}
                >
                    Save
                </Button>
            </ModalActions>
        </Modal>
    );
};

export default EditUnofficialEventModal;
