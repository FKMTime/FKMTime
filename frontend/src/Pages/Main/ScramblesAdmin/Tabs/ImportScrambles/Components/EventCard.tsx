import {
    Box,
    Card,
    CardBody,
    Heading,
    ListItem,
    Stack,
    Text,
    UnorderedList,
} from "@chakra-ui/react";
import { Event as IEvent } from "@wca/helpers";

import EventIcon from "@/Components/Icons/EventIcon";
import { activityCodeToName } from "@/lib/activities";
import { getEventName } from "@/lib/events";
import { numberToLetter } from "@/logic/utils";

interface EventCardProps {
    eventData: IEvent;
}

const EventCard = ({ eventData }: EventCardProps) => {
    return (
        <Card backgroundColor="gray.400">
            <CardBody>
                <Box display="flex" gap="2">
                    <EventIcon eventId={eventData.id} selected />
                    <Heading size="md">{getEventName(eventData.id)}</Heading>
                </Box>
                <Stack mt="3" spacing="1">
                    {eventData.rounds.map((round) => (
                        <Box key={round.id}>
                            <Text>{activityCodeToName(round.id)}</Text>
                            <UnorderedList>
                                {round.scrambleSets?.map((set, i: number) => (
                                    <ListItem key={set.id}>
                                        Set {numberToLetter(i + 1)} (
                                        {set.scrambles.length} scrambles,{" "}
                                        {set.extraScrambles.length} extra
                                        scrambles)
                                    </ListItem>
                                ))}
                            </UnorderedList>
                        </Box>
                    ))}
                </Stack>
            </CardBody>
        </Card>
    );
};

export default EventCard;
