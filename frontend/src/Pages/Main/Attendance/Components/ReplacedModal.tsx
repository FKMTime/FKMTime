import { useState } from "react";

import { Modal } from "@/Components/Modal";
import PersonAutocomplete from "@/Components/PersonAutocomplete";
import { Button } from "@/Components/ui/button";
import { Person, StaffActivity } from "@/lib/interfaces";

interface ReplacedModalProps {
    isOpen: boolean;
    onClose: () => void;
    activity: StaffActivity;
    onConfirm: (wasPresent: boolean, replacedById?: string) => void;
}

/** Someone else did the job: who, and whether the person was here at all */
const ReplacedModal = ({
    isOpen,
    onClose,
    activity,
    onConfirm,
}: ReplacedModalProps) => {
    const [replacement, setReplacement] = useState<Person | null>(null);
    const isSelf = replacement?.id === activity.person.id;

    const confirm = (wasPresent: boolean) => {
        onConfirm(wasPresent, replacement?.id);
        onClose();
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`${activity.person.name} was replaced`}
            error={isSelf ? "Pick someone other than the person replaced." : ""}
        >
            <p className="text-sm text-muted-foreground">
                Who did the job instead? Leave it empty if you don't know. They
                are added as present if they aren't yet.
            </p>
            <PersonAutocomplete
                onSelect={setReplacement}
                defaultValue={replacement?.id}
            />
            <div className="flex flex-wrap gap-2">
                <Button disabled={isSelf} onClick={() => confirm(true)}>
                    They were here
                </Button>
                <Button
                    variant="outline"
                    disabled={isSelf}
                    onClick={() => confirm(false)}
                >
                    They didn't come
                </Button>
            </div>
        </Modal>
    );
};

export default ReplacedModal;
