import { useEffect, useState } from "react";

import LoadingPage from "@/Components/LoadingPage";
import PlusButton from "@/Components/PlusButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { ScramblingDevice } from "@/lib/interfaces";
import { getScramblingDevices } from "@/lib/scramblingDevices";

import CreateScramblingDeviceModal from "./Components/CreateScramblingDeviceModal";
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
        <div className="flex flex-col gap-4">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        Scrambling devices
                        <PlusButton
                            onClick={() => setIsOpenCreateDeviceModal(true)}
                            title="Add new device"
                        />
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <ScramblingDevicesTable
                        devices={devices}
                        fetchData={fetchData}
                    />
                </CardContent>
            </Card>
            <CreateScramblingDeviceModal
                isOpen={isOpenCreateDeviceModal}
                onClose={handleCloseCreateDeviceModal}
            />
        </div>
    );
};

export default ScramblingDevices;
