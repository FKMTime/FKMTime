import { Box, ListItem, Text, UnorderedList } from "@chakra-ui/react";

import { Incident } from "@/logic/interfaces";

interface IncidentWarningsProps {
    previousIncidents: Incident[];
}

const IncidentWarnings = ({ previousIncidents }: IncidentWarningsProps) => {
    if (previousIncidents.length === 0) return null;

    const incidentsReason = new Set(previousIncidents.map((i) => i.comment));

    return (
        <Box>
            <Text>Previous extras:</Text>
            <UnorderedList>
                {Array.from(incidentsReason).map((reason) => (
                    <ListItem key={reason} fontWeight="bold">
                        {reason} -{" "}
                        {
                            previousIncidents.filter(
                                (i) => i.comment === reason
                            ).length
                        }{" "}
                        {previousIncidents.filter((i) => i.comment === reason)
                            .length === 1
                            ? "time"
                            : "times"}
                    </ListItem>
                ))}
            </UnorderedList>
        </Box>
    );
};

export default IncidentWarnings;
