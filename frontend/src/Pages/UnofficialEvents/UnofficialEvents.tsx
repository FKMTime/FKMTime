import { Box } from "@chakra-ui/react";
import { useEffect, useState } from "react";

import PlusButton from "@/Components/PlusButton";
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
                <PlusButton
                    aria-label="Add"
                    onClick={() => setIsOpenCreateUnofficialEventModal(true)}
                    title="Add new event"
                />
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
