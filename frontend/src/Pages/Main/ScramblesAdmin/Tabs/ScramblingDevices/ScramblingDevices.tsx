/* eslint-disable react-hooks/set-state-in-effect, react-hooks/preserve-manual-memoization */
import { Laptop } from "lucide-react";
import { useEffect, useState } from "react";

import LoadingPage from "@/Components/LoadingPage";
import PlusButton from "@/Components/PlusButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { ScramblingDevice } from "@/lib/interfaces";
import { getScramblingDevices } from "@/lib/scramblingDevices";
import PageTransition from "@/Pages/PageTransition";

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
        <PageTransition>
            <div className="flex flex-col gap-4">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                            <div className="flex gap-2 items-center">
                                <Laptop size={20} />
                                Scrambling devices
                            </div>
                            <PlusButton
                                onClick={() => setIsOpenCreateDeviceModal(true)}
                                title="Add new device"
                            />
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {devices.length === 0 ? (
                            <p>No scrambling devices found</p>
                        ) : (
                            <ScramblingDevicesTable
                                devices={devices}
                                fetchData={fetchData}
                            />
                        )}
                    </CardContent>
                </Card>
                <CreateScramblingDeviceModal
                    isOpen={isOpenCreateDeviceModal}
                    onClose={handleCloseCreateDeviceModal}
                />
            </div>
        </PageTransition>
    );
};

export default ScramblingDevices;
