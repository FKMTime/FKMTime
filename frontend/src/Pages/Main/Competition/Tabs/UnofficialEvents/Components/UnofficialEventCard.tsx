import {
    Box,
    Button,
    ButtonGroup,
    Card,
    CardBody,
    CardFooter,
    Divider,
    Heading,
    Stack,
    Text,
    useToast,
} from "@chakra-ui/react";
import { useConfirm } from "chakra-ui-confirm";
import { useState } from "react";
import { prettyRoundFormat } from "wcif-helpers";

import EventIcon from "@/Components/Icons/EventIcon";
import { getEventName } from "@/logic/events";
import { UnofficialEvent } from "@/logic/interfaces";
import { resultToString } from "@/logic/resultFormatters";
import { deleteUnofficialEvent } from "@/logic/unofficialEvents";

import EditUnofficialEventModal from "./EditUnofficialEventModal";

interface UnofficialEventCardProps {
    event: UnofficialEvent;
    fetchData: () => void;
}

const UnofficialEventCard = ({
    event,
    fetchData,
}: UnofficialEventCardProps) => {
    const confirm = useConfirm();
    const toast = useToast();
    const [isOpenEditUnofficialEventModal, setIsOpenEditUnofficialEventModal] =
        useState<boolean>(false);

    const handleDelete = () => {
        confirm({
            title: "Delete unofficial event",
            description: `Are you sure you want to delete ${getEventName(event.eventId)}? This action cannot be undone`,
        })
            .then(async () => {
                const status = await deleteUnofficialEvent(event.id);
                if (status === 204) {
                    toast({
                        title: "Successfully deleted event.",
                        status: "success",
                    });
                    fetchData();
                } else if (status === 409) {
                    toast({
                        title: "Error",
                        description: "Cannot delete event with results",
                        status: "error",
                    });
                } else {
                    toast({
                        title: "Error",
                        description: "Something went wrong",
                        status: "error",
                    });
                }
            })
            .catch(() => {
                toast({
                    title: "Cancelled",
                    description:
                        "You have cancelled the deletion of the event.",
                    status: "info",
                });
            });
    };

    const handleCloseEditModal = () => {
        setIsOpenEditUnofficialEventModal(false);
        fetchData();
    };

    return (
        <>
            <Card backgroundColor="gray.400">
                <CardBody>
                    <Box
                        display="flex"
                        gap={2}
                        alignItems="center"
                        justifyContent="space-between"
                        color="black"
                    >
                        <Heading size="md">
                            {getEventName(event.eventId)}
                        </Heading>
                        <EventIcon eventId={event.eventId} selected size={25} />
                    </Box>
                    <Stack mt="3" spacing="1">
                        {event.wcif.rounds.map((round, i: number) => (
                            <>
                                <Heading size="sm">Round {i + 1}</Heading>
                                <Text key={round.id}>
                                    Format: {prettyRoundFormat(round.format)}
                                </Text>
                                <Text>
                                    Time limit:{" "}
                                    {resultToString(
                                        round.timeLimit?.centiseconds || 0
                                    )}{" "}
                                    {round.timeLimit?.cumulativeRoundIds?.length
                                        ? "(cumulative)"
                                        : null}
                                </Text>
                                {round.cutoff && (
                                    <Text>
                                        Cutoff:{" "}
                                        {resultToString(
                                            round.cutoff?.attemptResult || 0
                                        )}{" "}
                                    </Text>
                                )}
                            </>
                        ))}
                    </Stack>
                </CardBody>
                <Divider />
                <CardFooter>
                    <ButtonGroup spacing="2">
                        <Button
                            variant="solid"
                            colorPalette="blue"
                            onClick={() =>
                                setIsOpenEditUnofficialEventModal(true)
                            }
                        >
                            Edit
                        </Button>
                        <Button
                            variant="solid"
                            colorPalette="red"
                            onClick={handleDelete}
                        >
                            Delete
                        </Button>
                    </ButtonGroup>
                </CardFooter>
            </Card>

            <EditUnofficialEventModal
                isOpen={isOpenEditUnofficialEventModal}
                onClose={handleCloseEditModal}
                unofficialEvent={event}
            />
        </>
    );
};

export default UnofficialEventCard;
