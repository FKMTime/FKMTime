import { useEffect, useState } from "react";

import { Modal } from "@/Components/Modal";
import { Person, Warning } from "@/lib/interfaces";
import { getWarningsForPerson } from "@/lib/warnings";

interface DisplayWarningsModalProps {
    isOpen: boolean;
    onClose: () => void;
    person: Person;
}

const DisplayWarningsModal = ({
    isOpen,
    onClose,
    person,
}: DisplayWarningsModalProps) => {
    const [warnings, setWarnings] = useState<Warning[]>([]);

    useEffect(() => {
        if (isOpen) {
            getWarningsForPerson(person.id).then((data) => {
                setWarnings(data);
            });
        }
    }, [isOpen, person.id]);

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Warnings for ${person.name}`}
        >
            {warnings.length > 0 ? (
                <ul className="list-disc pl-5 mb-3">
                    {warnings.map((warning) => (
                        <li key={warning.id}>
                            {warning.description} - issued by{" "}
                            {warning.createdBy.fullName}
                        </li>
                    ))}
                </ul>
            ) : (
                <h2 className="text-lg mb-3">No warnings found</h2>
            )}
        </Modal>
    );
};

export default DisplayWarningsModal;
