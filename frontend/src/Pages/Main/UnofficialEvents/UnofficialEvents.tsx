/* eslint-disable react-hooks/set-state-in-effect, react-hooks/preserve-manual-memoization */
import { Medal } from "lucide-react";
import { useEffect, useState } from "react";

import PlusButton from "@/Components/PlusButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { UnofficialEvent } from "@/lib/interfaces";
import { getCompetitionUnofficialEvents } from "@/lib/unofficialEvents";
import PageTransition from "@/Pages/PageTransition";

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
        <PageTransition>
            <Card>
                <CardHeader>
                    <CardTitle className="flex justify-between items-center">
                        <div className="flex gap-2 items-center">
                            <Medal size={20} />
                            Unofficial events
                        </div>
                        <PlusButton
                            aria-label="Add"
                            onClick={() =>
                                setIsOpenCreateUnofficialEventModal(true)
                            }
                        />
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {unofficialEvents.length === 0 ? (
                        <p>No unofficial events found</p>
                    ) : (
                        <UnofficialEventsTable
                            events={unofficialEvents}
                            fetchData={fetchData}
                        />
                    )}
                </CardContent>
            </Card>
            <CreateUnofficialEventModal
                isOpen={isOpenCreateUnofficialEventModal}
                onClose={handleCloseCreateModal}
            />
        </PageTransition>
    );
};

export default UnofficialEvents;
