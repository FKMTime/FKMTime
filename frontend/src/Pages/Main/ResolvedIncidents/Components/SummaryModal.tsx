import { Box, ListItem, UnorderedList } from "@chakra-ui/react";

import { Modal } from "@/Components/Modal";
import { groupIncidents } from "@/lib/incidents";
import { AttemptStatus, Incident } from "@/lib/interfaces";
import { shortRoundName } from "@/logic/utils";

interface SummaryModalProps {
    incidents: Incident[];
    isOpen: boolean;
    onClose: () => void;
}

const SummaryModal = ({ incidents, isOpen, onClose }: SummaryModalProps) => {
    const groupedIncidents = groupIncidents(incidents);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Incidents summary">
            <Box display="flex" flexDirection="column" gap="5">
                {groupedIncidents.map((group) => {
                    return (
                        <Box key={group.category}>
                            <Box fontWeight="bold">
                                {group.category} - {group.incidents.length}{" "}
                                incidents
                            </Box>
                            <UnorderedList>
                                {group.incidents.map((incident) => {
                                    return (
                                        <ListItem key={incident.id}>
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
                                        </ListItem>
                                    );
                                })}
                            </UnorderedList>
                        </Box>
                    );
                })}
            </Box>
        </Modal>
    );
};

export default SummaryModal;
