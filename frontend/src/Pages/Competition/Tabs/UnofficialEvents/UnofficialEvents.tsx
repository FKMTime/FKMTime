import { Box, Button } from "@chakra-ui/react";
import { useEffect, useState } from "react";

import { getCompetitionUnofficialEvents } from "@/logic/events";
import { UnofficialEvent } from "@/logic/interfaces";

import CreateUnofficialEventModal from "./Components/CreateUnofficialEventModal";
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
                    colorScheme="blue"
                    onClick={() => setIsOpenCreateUnofficialEventModal(true)}
                >
                    Add new event
                </Button>
            </Box>
            <UnofficialEventsTable
                events={unofficialEvents}
                fetchData={fetchData}
            />
            <CreateUnofficialEventModal
                isOpen={isOpenCreateUnofficialEventModal}
                onClose={handleCloseCreateModal}
            />
        </Box>
    );
};

export default UnofficialEvents;
