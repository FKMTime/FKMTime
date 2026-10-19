import { Plus } from "lucide-react";
import { useEffect, useState } from "react";

import LoadingPage from "@/Components/LoadingPage";
import EmptyState from "@/Components/shared/EmptyState";
import { Button } from "@/Components/ui/button";
import { useIsMobile } from "@/hooks/useMobile";
import { ScramblingDevice } from "@/lib/interfaces";
import { getScramblingDevices } from "@/lib/scramblingDevices";

import CreateScramblingDeviceModal from "./Components/CreateScramblingDeviceModal";
import ScramblingDeviceRow from "./Components/ScramblingDeviceRow";

const ScramblingDevices = () => {
    const isMobile = useIsMobile();
    const [devices, setDevices] = useState<ScramblingDevice[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isOpenCreateDeviceModal, setIsOpenCreateDeviceModal] =
        useState<boolean>(false);

    const fetchData = async () => {
        setIsLoading(true);
        const data = await getScramblingDevices();
        setDevices(data);
        setIsLoading(false);
    };

    const handleCloseCreateDeviceModal = () => {
        setIsOpenCreateDeviceModal(false);
        fetchData();
    };

    useEffect(() => {
        fetchData();
    }, []);

    if (isLoading) return <LoadingPage />;

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
