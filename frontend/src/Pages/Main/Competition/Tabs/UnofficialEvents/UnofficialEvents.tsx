import { Box } from "@chakra-ui/react";
import { useEffect, useState } from "react";

import { Button } from "@/Components/ui/button";
import { UnofficialEvent } from "@/logic/interfaces";
import { getCompetitionUnofficialEvents } from "@/logic/unofficialEvents";

import CreateUnofficialEventModal from "./Components/CreateUnofficialEventModal";
import UnofficialEventCard from "./Components/UnofficialEventCard";
import UnofficialEventsTable from "./Components/UnofficialEventsTable";

const UnofficialEvents = () => {
    const [unofficialEvents, setUnofficialEvents] = useState<UnofficialEvent[]>(
        []
    );
    const [
        isOpenCreateUnofficialEventModal,
        setIsOpenCreateUnofficialEventModal,
    ] = useState(false);

    const fetchData = async () => {
        const data = await getCompetitionUnofficialEvents();
        setUnofficialEvents(data);
    };

    const handleCloseCreateModal = () => {
        setIsOpenCreateUnofficialEventModal(false);
        fetchData();
    };

    useEffect(() => {
        fetchData();
    }, []);

    return (
        <Box display="flex" flexDirection="column" gap="5">
            <Box display="flex" gap="2">
                <Button
                    colorPalette="blue"
                    width={{ base: "100%", md: "auto" }}
                    onClick={() => setIsOpenCreateUnofficialEventModal(true)}
                >
                    Add new event
                </Button>
            </Box>
            <Box
                display={{ base: "flex", md: "none" }}
                gap="5"
                flexDirection="column"
            >
                {unofficialEvents.map((event) => (
                    <UnofficialEventCard
                        key={event.id}
                        event={event}
                        fetchData={fetchData}
                    />
                ))}
            </Box>
            <Box display={{ base: "none", md: "block" }}>
                <UnofficialEventsTable
                    events={unofficialEvents}
                    fetchData={fetchData}
                />
            </Box>
            <CreateUnofficialEventModal
                isOpen={isOpenCreateUnofficialEventModal}
                onClose={handleCloseCreateModal}
            />
        </Box>
    );
};

export default UnofficialEvents;
