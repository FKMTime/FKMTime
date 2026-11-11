import { Plus } from "lucide-react";
import { useState } from "react";

import LoadingPage from "@/Components/LoadingPage";
import EmptyState from "@/Components/shared/EmptyState";
import { Button } from "@/Components/ui/button";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { useIsMobile } from "@/hooks/useMobile";
import { scramblingDevicesQuery } from "@/lib/scramblingDevices";

import CreateScramblingDeviceModal from "./Components/CreateScramblingDeviceModal";
import ScramblingDeviceRow from "./Components/ScramblingDeviceRow";

const ScramblingDevices = () => {
    const isMobile = useIsMobile();
    // null until the first load; refreshes keep the list on screen
    const { data: devices, refetch } = useLiveQuery(scramblingDevicesQuery);
    const [isOpenCreateDeviceModal, setIsOpenCreateDeviceModal] =
        useState<boolean>(false);

    const fetchData = () => void refetch();

    const handleCloseCreateDeviceModal = () => {
        setIsOpenCreateDeviceModal(false);
        fetchData();
    };

    if (!devices) return <LoadingPage />;

    return (
        <>
            <Button
                onClick={() => setIsOpenCreateDeviceModal(true)}
                variant={isMobile ? "outline" : "default"}
                size={isMobile ? "lg" : "default"}
                className="md:ml-auto md:w-fit"
            >
                <Plus />
                Add device
            </Button>
            {devices.length === 0 ? (
                <EmptyState>No scrambling devices yet</EmptyState>
            ) : (
                <ul className="overflow-hidden rounded-mobile-card border bg-card md:rounded-2xl">
                    {devices.map((device) => (
                        <ScramblingDeviceRow
                            key={device.id}
                            device={device}
                            fetchData={fetchData}
                        />
                    ))}
                </ul>
            )}
            <CreateScramblingDeviceModal
                isOpen={isOpenCreateDeviceModal}
                onClose={handleCloseCreateDeviceModal}
            />
        </>
    );
};

export default ScramblingDevices;
