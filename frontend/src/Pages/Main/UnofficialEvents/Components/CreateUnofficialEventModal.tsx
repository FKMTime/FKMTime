import { Round } from "@wca/helpers";
import { useEffect, useState } from "react";

import { Modal } from "@/Components/Modal";
import ModalActions from "@/Components/ModalActions";
import { Button } from "@/Components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/Components/ui/select";
import { useToast } from "@/hooks/useToast";
import { getUnofficialEvents } from "@/lib/events";
import { Event } from "@/lib/interfaces";
import { createUnofficialEvent } from "@/lib/unofficialEvents";

import RoundsManager from "./RoundsManager";

interface CreateUnofficialEventModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const CreateUnofficialEventModal = ({
    isOpen,
    onClose,
}: CreateUnofficialEventModalProps) => {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [events, setEvents] = useState<Event[]>([]);
    const [selectedEventId, setSelectedEventId] = useState<string>("");
    const [rounds, setRounds] = useState<Round[]>([]);

    const handleSubmit = async () => {
        setIsLoading(true);
        const roundsToSend = rounds.map((round) => {
            if (round.cutoff?.attemptResult === 0) {
                round.cutoff = null;
            }
            return round;
        });
        const status = await createUnofficialEvent(
            selectedEventId,
            roundsToSend
        );
        if (status === 201) {
            toast({
                title: "Successfully added unofficial event",
                variant: "success",
            });
            setRounds([]);
            setSelectedEventId("");
            onClose();
        } else if (status === 409) {
            toast({
                title: "Error",
                description: "Event already exists",
                variant: "destructive",
            });
        } else {
            toast({
                title: "Error",
                description: "Something went wrong",
                variant: "destructive",
            });
        }
        setIsLoading(false);
    };

    const updateSelectedEventId = (value: string) => {
        setSelectedEventId(value);
        setRounds([]);
    };

    useEffect(() => {
        getUnofficialEvents().then((data) => {
            setEvents(data);
        });
    }, []);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Add unofficial event">
            <Select
                value={selectedEventId}
                onValueChange={updateSelectedEventId}
            >
                <SelectTrigger>
                    <SelectValue placeholder="Select event" />
                </SelectTrigger>
                <SelectContent>
                    {events.map((event) => (
                        <SelectItem key={event.id} value={event.id}>
                            {event.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            {selectedEventId ? (
                <RoundsManager
                    selectedEventId={selectedEventId}
                    rounds={rounds}
                    setRounds={setRounds}
                />
            ) : null}
            <ModalActions>
                <Button
                    variant="success"
                    onClick={handleSubmit}
                    disabled={isLoading}
                >
                    Add unofficial event
                </Button>
            </ModalActions>
        </Modal>
    );
};

export default CreateUnofficialEventModal;
