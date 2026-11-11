import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";

import EmptyState from "@/Components/shared/EmptyState";
import RequestError from "@/Components/shared/RequestError";
import { Button } from "@/Components/ui/button";
import { useIsMobile } from "@/hooks/useMobile";
import { toQueryOptions } from "@/lib/queryCache";
import { unofficialEventsQuery } from "@/lib/unofficialEvents";
import SetupTabs from "@/Pages/Main/Setup/SetupTabs";

import CreateUnofficialEventModal from "./Components/CreateUnofficialEventModal";
import UnofficialEventRow from "./Components/UnofficialEventRow";

const UnofficialEvents = () => {
    const isMobile = useIsMobile();
    const queryClient = useQueryClient();
    const {
        data: unofficialEvents,
        isError,
        refetch,
    } = useQuery(toQueryOptions(unofficialEventsQuery));
    const [
        isOpenCreateUnofficialEventModal,
        setIsOpenCreateUnofficialEventModal,
    ] = useState(false);

    const fetchData = () =>
        void queryClient.invalidateQueries({
            queryKey: toQueryOptions(unofficialEventsQuery).queryKey,
        });
    const retry = () => void refetch();

    const handleCloseCreateModal = () => {
        setIsOpenCreateUnofficialEventModal(false);
        fetchData();
    };

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
            {isError && (
                <RequestError hasData={!!unofficialEvents} onRetry={retry} />
            )}
            {!unofficialEvents ? null : unofficialEvents.length === 0 ? (
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
