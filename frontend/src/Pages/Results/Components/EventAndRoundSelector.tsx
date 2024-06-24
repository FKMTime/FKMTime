import { Box, IconButton, Select } from "@chakra-ui/react";
import { Event, Round } from "@wca/helpers";

import EventIcon from "@/Components/Icons/EventIcon";
import { Competition } from "@/logic/interfaces";

interface EventAndRoundSelectorProps {
    competition: Competition;
    filters: {
        eventId: string;
        roundId: string;
    };
    handleEventChange: (eventId: string) => void;
    handleRoundChange: (roundId: string) => void;
}

const EventAndRoundSelector = ({
    competition,
    filters,
    handleEventChange,
    handleRoundChange,
}: EventAndRoundSelectorProps) => {
    return (
        <>
            <Box display="flex" flexDirection="row" gap="5">
                {competition.wcif.events.map((event: Event) => (
                    <IconButton
                        key={event.id}
                        aria-label={event.id}
                        icon={
                            <EventIcon
                                eventId={event.id}
                                selected={filters.eventId === event.id}
                                size={20}
                            />
                        }
                        onClick={() => handleEventChange(event.id)}
                        justifyContent="center"
                        alignItems="center"
                    />
                ))}
            </Box>
            <Box width={{ base: "100%", md: "5%" }}>
                <Select
                    value={filters.roundId}
                    onChange={(event) =>
                        handleRoundChange(event.target.value as string)
                    }
                >
                    {competition.wcif.events
                        .find((event: Event) => event.id === filters.eventId)
                        ?.rounds.map((round: Round, i: number) => (
                            <option key={round.id} value={round.id}>
                                {i + 1}
                            </option>
                        ))}
                </Select>
            </Box>
        </>
    );
};

export default EventAndRoundSelector;
