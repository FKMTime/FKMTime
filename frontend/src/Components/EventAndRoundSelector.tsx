import { Box, IconButton } from "@chakra-ui/react";
import { Event, Round } from "@wca/helpers";

import EventIcon from "@/Components/Icons/EventIcon";
import { Competition } from "@/logic/interfaces";

import Select from "./Select";
import { Field } from "./ui/field";

interface EventAndRoundSelectorProps {
    competition: Competition;
    filters: {
        eventId: string;
        roundId: string;
    };
    showLabel?: boolean;
    handleEventChange: (eventId: string) => void;
    handleRoundChange: (roundId: string) => void;
}

const EventAndRoundSelector = ({
    competition,
    filters,
    showLabel,
    handleEventChange,
    handleRoundChange,
}: EventAndRoundSelectorProps) => {
    return (
        <>
            <Box
                display="flex"
                flexDirection="row"
                gap="5"
                flexWrap="wrap"
                width={{ base: "90%", md: "auto" }}
            >
                {competition.wcif.events.map((event: Event) => (
                    <IconButton
                        key={event.id}
                        aria-label={event.id}
                        onClick={() => handleEventChange(event.id)}
                        justifyContent="center"
                        alignItems="center"
                    >
                        <EventIcon
                            eventId={event.id}
                            selected={filters.eventId === event.id}
                            size={20}
                        />
                    </IconButton>
                ))}
            </Box>
            {filters.eventId && (
                <Field label={showLabel ? "Round" : undefined}>
                    <Select
                        value={filters.roundId}
                        onChange={(event) =>
                            handleRoundChange(event.target.value as string)
                        }
                        width="fit-content"
                    >
                        {competition.wcif.events
                            .find(
                                (event: Event) => event.id === filters.eventId
                            )
                            ?.rounds.map((round: Round, i: number) => (
                                <option key={round.id} value={round.id}>
                                    Round {i + 1}
                                </option>
                            ))}
                    </Select>
                </Field>
            )}
        </>
    );
};

export default EventAndRoundSelector;
