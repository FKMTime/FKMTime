import { Modal } from "@/Components/Modal";
import { Person } from "@/lib/interfaces";

interface MissingPersonsModalProps {
    isOpen: boolean;
    onClose: () => void;
    persons: Pick<Person, "id" | "name" | "registrantId" | "wcaId">[];
}

const MissingPersonsModal = ({
    isOpen,
    onClose,
    persons,
}: MissingPersonsModalProps) => {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Missing competitors (${persons.length})`}
        >
            {persons.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                    All eligible competitors have results.
                </p>
            ) : (
                <ul className="flex flex-col gap-1 text-sm max-h-96 overflow-y-auto">
                    {persons.map((p) => (
                        <li
                            key={p.id}
                            className="flex items-center justify-between py-1 border-b last:border-0"
                        >
                            <span className="font-medium">{p.name}</span>
                            <span className="text-muted-foreground text-xs">
                                #{p.registrantId}
                                {p.wcaId ? ` · ${p.wcaId}` : ""}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </Modal>
    );
};

export default MissingPersonsModal;
