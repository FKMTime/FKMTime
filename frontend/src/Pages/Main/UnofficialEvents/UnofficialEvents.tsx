import { Plus } from "lucide-react";
import { useEffect, useState } from "react";

import EmptyState from "@/Components/shared/EmptyState";
import { Button } from "@/Components/ui/button";
import { useIsMobile } from "@/hooks/useMobile";
import { UnofficialEvent } from "@/lib/interfaces";
import { getCompetitionUnofficialEvents } from "@/lib/unofficialEvents";
import SetupTabs from "@/Pages/Main/Setup/SetupTabs";

import CreateUnofficialEventModal from "./Components/CreateUnofficialEventModal";
import UnofficialEventRow from "./Components/UnofficialEventRow";

const UnofficialEvents = () => {
    const isMobile = useIsMobile();
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
        <>
            <SetupTabs value="events" />
            <Button
                onClick={() => setIsOpenCreateUnofficialEventModal(true)}
                variant={isMobile ? "outline" : "default"}
                size={isMobile ? "lg" : "default"}
                className="md:ml-auto md:w-fit"
            >
                <Plus />
                Add unofficial event
            </Button>
            {unofficialEvents.length === 0 ? (
                <EmptyState>No unofficial events yet</EmptyState>
            ) : (
                <ul className="overflow-hidden rounded-mobile-card border bg-card md:rounded-2xl">
                    {unofficialEvents.map((event) => (
                        <UnofficialEventRow
                            key={event.id}
                            event={event}
                            fetchData={fetchData}
                        />
                    ))}
                </ul>
            )}
            <CreateUnofficialEventModal
                isOpen={isOpenCreateUnofficialEventModal}
                onClose={handleCloseCreateModal}
            />
        </>
    );
};

export default UnofficialEvents;
