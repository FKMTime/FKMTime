import { FormEvent, useState } from "react";

import { Modal } from "@/Components/Modal";
import ModalActions from "@/Components/ModalActions";
import PersonAutocomplete from "@/Components/PersonAutocomplete";
import InlineError from "@/Components/shared/InlineError";
import { Button } from "@/Components/ui/button";
import { Label } from "@/Components/ui/label";
import { Textarea } from "@/Components/ui/textarea";
import { useToast } from "@/hooks/useToast";
import { Person } from "@/lib/interfaces";
import { issueWarning } from "@/lib/warnings";

interface AddWarningModalProps {
    isOpen: boolean;
    onClose: (created: boolean) => void;
}

/** Issue a warning to any competitor from the Warnings tab */
const AddWarningModal = ({ isOpen, onClose }: AddWarningModalProps) => {
    const { toast } = useToast();
    const [person, setPerson] = useState<Person | null>(null);
    const [description, setDescription] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const close = (created: boolean) => {
        setPerson(null);
        setDescription("");
        setError("");
        onClose(created);
    };

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        if (!person) return setError("Choose a competitor.");
        if (!description.trim()) return setError("Describe the warning.");
        setIsLoading(true);
        const status = await issueWarning(person.id, {
            description: description.trim(),
        });
        setIsLoading(false);
        if (status === 201) {
            toast({
                title: "Successfully issued warning.",
                variant: "success",
            });
            close(true);
        } else {
            setError("Something went wrong. Try again.");
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={() => close(false)} title="Add warning">
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                    <Label>Competitor</Label>
                    <PersonAutocomplete onSelect={setPerson} />
                </div>
                <div className="flex flex-col gap-2">
                    <Label htmlFor="warning-description">Description</Label>
                    <Textarea
                        id="warning-description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="What happened?"
                    />
                </div>
                <InlineError>{error}</InlineError>
                <ModalActions>
                    <Button type="submit" disabled={isLoading}>
                        Add warning
                    </Button>
                </ModalActions>
            </form>
        </Modal>
    );
};

export default AddWarningModal;
