import { Box, Button } from "@chakra-ui/react";
import { useEffect, useState } from "react";

import LoadingPage from "@/Components/LoadingPage";
import PlusButton from "@/Components/PlusButton";
import { ScramblingDevice } from "@/lib/interfaces";
import { getScramblingDevices } from "@/lib/scramblingDevices";

import CreateScramblingDeviceModal from "./Components/CreateScramblingDeviceModal";
import ScramblingDeviceCard from "./Components/ScramblingDeviceCard";
import ScramblingDevicesTable from "./Components/ScramblingDevicesTable";

const ScramblingDevices = () => {
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
        <Box display="flex" flexDirection="column" gap="3">
            <PlusButton
                display={{ base: "flex", md: "none" }}
                aria-label="Add"
                onClick={() => setIsOpenCreateDeviceModal(true)}
                title="Add new device"
            />
            <Button
                colorScheme="green"
                onClick={() => setIsOpenCreateDeviceModal(true)}
                display={{ base: "none", md: "flex" }}
                width="fit-content"
            >
                Add new device
            </Button>
            <Box display={{ base: "none", md: "block" }}>
                <ScramblingDevicesTable
                    devices={devices}
                    fetchData={fetchData}
                />
            </Box>
            <Box
                display={{ base: "flex", md: "none" }}
                flexDirection="column"
                gap={3}
            >
                {devices.map((device) => (
                    <ScramblingDeviceCard
                        key={device.id}
                        device={device}
                        fetchData={fetchData}
                    />
                ))}
            </Box>
            <CreateScramblingDeviceModal
                isOpen={isOpenCreateDeviceModal}
                onClose={handleCloseCreateDeviceModal}
            />
        </Box>
    );
};

export default ScramblingDevices;
