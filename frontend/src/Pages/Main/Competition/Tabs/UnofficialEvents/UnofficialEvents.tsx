import { useEffect, useState } from "react";

import PlusButton from "@/Components/PlusButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { UnofficialEvent } from "@/lib/interfaces";
import { getCompetitionUnofficialEvents } from "@/lib/unofficialEvents";

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
        <Card>
            <CardHeader>
                <CardTitle className="flex justify-between items-center">
                    Unofficial events
                    <PlusButton
                        aria-label="Add"
                        onClick={() =>
                            setIsOpenCreateUnofficialEventModal(true)
                        }
                    />
                </CardTitle>
            </CardHeader>
            <CardContent>
                <UnofficialEventsTable
                    events={unofficialEvents}
                    fetchData={fetchData}
                />
                <CreateUnofficialEventModal
                    isOpen={isOpenCreateUnofficialEventModal}
                    onClose={handleCloseCreateModal}
                />
            </CardContent>
        </Card>
    );
};

export default UnofficialEvents;
