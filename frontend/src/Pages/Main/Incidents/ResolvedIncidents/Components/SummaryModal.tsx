import { Modal } from "@/Components/Modal";
import { groupIncidents } from "@/lib/incidents";
import { AttemptStatus, Incident } from "@/lib/interfaces";
import { shortRoundName } from "@/lib/utils";

interface SummaryModalProps {
    incidents: Incident[];
    isOpen: boolean;
    onClose: () => void;
}

const SummaryModal = ({ incidents, isOpen, onClose }: SummaryModalProps) => {
    const groupedIncidents = groupIncidents(incidents);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Incidents summary">
            <div className="flex flex-col gap-5 h-96 overflow-y-auto">
                {groupedIncidents.map((group) => {
                    return (
                        <div key={group.category}>
                            <div className="font-bold">
                                {group.category} - {group.incidents.length}{" "}
                                incidents
                            </div>
                            <ul className="list-disc pl-5">
                                {group.incidents.map((incident) => {
                                    return (
                                        <li key={incident.id}>
                                            {incident.result.person.name} -{" "}
                                            {shortRoundName(
                                                incident.result.roundId
                                            )}
                                            A{incident.attemptNumber} -{" "}
                                            {incident.status ===
                                            AttemptStatus.EXTRA_GIVEN
                                                ? "Extra given"
                                                : incident.penalty === -1
                                                  ? "DNF"
                                                  : "Original time stands"}
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    );
                })}
            </div>
        </Modal>
    );
};

export default SummaryModal;
