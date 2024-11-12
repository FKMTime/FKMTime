import { Box } from "@chakra-ui/react";
import { Competition as WCIF } from "@wca/helpers";

import EventCard from "./EventCard";

interface ScrambleSetsListProps {
    wcif: WCIF;
}

const ScrambleSetsList = ({ wcif }: ScrambleSetsListProps) => {
    return (
        <Box display="flex" flexDirection="row" gap="5" flexWrap="wrap">
            {wcif.events.map((event) => (
                <EventCard key={event.id} eventData={event} />
            ))}
        </Box>
    );
};

export default ScrambleSetsList;
