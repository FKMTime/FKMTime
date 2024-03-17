import { useEffect, useState } from "react";
import { getAllDevices } from "../../logic/devices.ts";
import LoadingPage from "../../Components/LoadingPage";
import { Device } from "../../logic/interfaces";
import { Box, IconButton } from "@chakra-ui/react";
import { MdAdd } from "react-icons/md";
import CreateDeviceModal from "../../Components/Modal/CreateDeviceModal.tsx";
import DevicesTable from "../../Components/Table/DevicesTable.tsx";
import io from "socket.io-client";
import { DEVICES_WEBSOCKET_URL } from "../../logic/request.ts";
import { getToken } from "../../logic/auth.ts";

const Devices = (): JSX.Element => {
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [devices, setDevices] = useState<Device[]>([]);
    const [isOpenCreateDeviceModal, setIsOpenCreateDeviceModal] =
        useState<boolean>(false);
    const [socket] = useState(
        io(DEVICES_WEBSOCKET_URL, {
            transports: ["websocket"],
            auth: {
                token: getToken(),
            },
        })
    );

    const fetchData = async () => {
        setIsLoading(true);
        const data = await getAllDevices();
        setDevices(data);
        setIsLoading(false);
    };

    const handleCloseCreateDeviceModal = async () => {
        await fetchData();
        setIsOpenCreateDeviceModal(false);
    };

    useEffect(() => {
        fetchData();
        socket.emit("join");

        socket.on("deviceUpdated", () => {
            fetchData();
        });

        return () => {
            socket.emit("leave");
        };
    }, [socket]);

    if (isLoading) return <LoadingPage />;

    return (
        <Box display="flex" flexDirection="column" gap="5">
            <IconButton
                icon={<MdAdd />}
                aria-label="Add"
                bg="white"
                color="black"
                rounded="20"
                width="5"
                height="10"
                _hover={{
                    background: "white",
                    color: "gray.700",
                }}
                onClick={() => setIsOpenCreateDeviceModal(true)}
            />
            <DevicesTable devices={devices} fetchData={fetchData} />
            <CreateDeviceModal
                isOpen={isOpenCreateDeviceModal}
                onClose={handleCloseCreateDeviceModal}
            />
        </Box>
    );
};

export default Devices;
