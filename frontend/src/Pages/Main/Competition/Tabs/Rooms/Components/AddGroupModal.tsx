import { Activity, Event, Round } from "@wca/helpers";
import { useMemo, useState } from "react";

import { Modal } from "@/Components/Modal";
import ModalActions from "@/Components/ModalActions";
import { Button } from "@/Components/ui/button";
import { Label } from "@/Components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/Components/ui/select";
import { getGroupsByRoundId } from "@/lib/activities";
import { getEventName } from "@/lib/events";
import { Competition, Room } from "@/lib/interfaces";

interface AddGroupModalProps {
    isOpen: boolean;
    onClose: () => void;
    competition: Competition;
    room: Room;
    onSubmit: (groupId: string) => void;
}

const AddGroupModal = ({
    isOpen,
    onClose,
    competition,
    onSubmit,
}: AddGroupModalProps) => {
    const [currentEvent, setCurrentEvent] = useState<string>("");
    const [currentRound, setCurrentRound] = useState<string>("");
    const [currentGroup, setCurrentGroup] = useState<string>("");
    const groups = useMemo(() => {
        if (
            !competition ||
            !currentRound ||
            !currentEvent ||
            currentEvent === ""
        ) {
            return [];
        }
        return getGroupsByRoundId(currentRound, competition.wcif);
    }, [competition, currentEvent, currentRound]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Add group">
            <div className="space-y-2">
                <Label>Event</Label>
                <Select
                    onValueChange={(value) => {
                        if (value === "" || value === "NONE") {
                            setCurrentEvent("");
                            setCurrentRound("");
                            return;
                        }
                        setCurrentEvent(value);
                        setCurrentRound(value + "-r1");
                        setCurrentGroup(value + "-r1-g1");
                    }}
                    value={currentEvent}
                >
                    <SelectTrigger>
                        <SelectValue placeholder="Select event" />
                    </SelectTrigger>
                    <SelectContent>
                        {competition.wcif.events.map((event: Event) => (
                            <SelectItem key={event.id} value={event.id}>
                                {getEventName(event.id)}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-2">
                <Label>Round</Label>
                <Select
                    onValueChange={(value) => {
                        setCurrentRound(value);
                        setCurrentGroup(value + "-g1");
                    }}
                    value={currentRound}
                >
                    <SelectTrigger>
                        <SelectValue placeholder="Select round" />
                    </SelectTrigger>
                    <SelectContent>
                        {competition.wcif.events
                            .find((event: Event) => event.id === currentEvent)
                            ?.rounds.map((round: Round, i: number) => (
                                <SelectItem key={round.id} value={round.id}>
                                    {i + 1}
                                </SelectItem>
                            ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-2">
                <Label>Group</Label>
                <Select
                    onValueChange={(value) => {
                        setCurrentGroup(value);
                    }}
                    value={currentGroup}
                >
                    <SelectTrigger>
                        <SelectValue placeholder="Select group" />
                    </SelectTrigger>

                    <SelectContent>
                        {groups.map((group: Activity, i: number) => (
                            <SelectItem
                                key={group.activityCode}
                                value={group.activityCode}
                            >
                                {i + 1}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <ModalActions>
                <Button
                    variant="success"
                    onClick={() => onSubmit(currentGroup)}
                    disabled={currentGroup === ""}
                >
                    Add
                </Button>
            </ModalActions>
        </Modal>
    );
};

export default AddGroupModal;
