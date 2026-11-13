import { useState } from "react";

import GroupPlacement from "@/Components/IntegratedLive/GroupPlacement";
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
import { useDialogError } from "@/hooks/useDialogError";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { useToast } from "@/hooks/useToast";
import { activityCodeToName } from "@/lib/activities";
import {
    addCompetitorToIntegratedLiveRound,
    integratedLiveAddableQuery,
    invalidateIntegratedLiveRounds,
} from "@/lib/integratedLive";

interface AddCompetitorToRoundModalProps {
    isOpen: boolean;
    onClose: () => void;
    roundId: string;
}

/**
 * Adds a competitor to a first round in WCA Integrated Live Results. Only
 * people whose WCA registration includes the event are offered: adding an
 * event to a registration happens on the WCA website (SPEC-006).
 */
const AddCompetitorToRoundModal = ({
    isOpen,
    onClose,
    roundId,
}: AddCompetitorToRoundModalProps) => {
    const [error, setError] = useDialogError(isOpen);
    const { toast } = useToast();
    const [registrationId, setRegistrationId] = useState("");
    const [isAdding, setIsAdding] = useState(false);
    const [added, setAdded] = useState<{
        personId: string;
        name: string;
    } | null>(null);
    const { data: addable } = useLiveQuery(
        integratedLiveAddableQuery(roundId),
        { enabled: isOpen }
    );
    const roundName = activityCodeToName(roundId);

    const handleAdd = async () => {
        if (!registrationId) return;
        setIsAdding(true);
        const { ok, message, personId } =
            await addCompetitorToIntegratedLiveRound(
                roundId,
                Number(registrationId)
            );
        setIsAdding(false);
        if (!ok) {
            setError(message);
            return;
        }
        const person = addable?.find(
            (c) => String(c.registrationId) === registrationId
        );
        toast({
            title: `${person?.name ?? "Competitor"} added to ${roundName}`,
            variant: "success",
        });
        void invalidateIntegratedLiveRounds();
        setRegistrationId("");
        if (personId) {
            // Offer a group before closing, like after a withdrawal
            setAdded({ personId, name: person?.name ?? "They" });
            return;
        }
        onClose();
    };

    const handleClose = () => {
        setAdded(null);
        onClose();
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            title={`Add competitor to ${roundName}`}
            error={error}
        >
            {added ? (
                <div className="flex flex-col gap-3">
                    <GroupPlacement
                        roundId={roundId}
                        personId={added.personId}
                        name={added.name}
                    />
                    <ModalActions>
                        <Button variant="outline" onClick={handleClose}>
                            Done
                        </Button>
                    </ModalActions>
                </div>
            ) : (
                <div className="flex flex-col gap-3">
                    <p className="text-sm text-muted-foreground">
                        Adds them to the round in WCA Integrated Live Results.
                    </p>
                    {addable && addable.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            Everyone registered for this event is already in the
                            round.
                        </p>
                    ) : (
                        <Select
                            value={registrationId}
                            onValueChange={setRegistrationId}
                        >
                            <SelectTrigger aria-label="Competitor">
                                <SelectValue placeholder="Choose a competitor" />
                            </SelectTrigger>
                            <SelectContent>
                                {(addable ?? []).map((competitor) => (
                                    <SelectItem
                                        key={competitor.registrationId}
                                        value={String(
                                            competitor.registrationId
                                        )}
                                    >
                                        {competitor.name}
                                        {competitor.wcaId
                                            ? ` (${competitor.wcaId})`
                                            : ""}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                    <p className="text-[13px] text-muted-foreground">
                        Not in the list? Only people whose WCA registration
                        includes this event can be added. Adding the event to a
                        registration happens on the WCA website.
                    </p>
                    <ModalActions>
                        <Button
                            onClick={handleAdd}
                            disabled={!registrationId || isAdding}
                        >
                            Add to round
                        </Button>
                    </ModalActions>
                </div>
            )}
        </Modal>
    );
};

export default AddCompetitorToRoundModal;
