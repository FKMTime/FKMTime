import { Modal } from "@/Components/Modal";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { Person, Warning } from "@/lib/interfaces";
import { personWarningsQuery } from "@/lib/warnings";

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
    const { data } = useLiveQuery(personWarningsQuery(person.id), {
        enabled: isOpen,
    });
    const warnings: Warning[] = data ?? [];

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
