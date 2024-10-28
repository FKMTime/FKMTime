import { Td, Tr, useToast } from "@chakra-ui/react";
import { useConfirm } from "chakra-ui-confirm";
import { useState } from "react";

import DeleteButton from "@/Components/DeleteButton";
import EditButton from "@/Components/EditButton";
import { ScramblingDevice } from "@/logic/interfaces";
import { deleteScramblingDevice } from "@/logic/scramblingDevices";

import EditScramblingDeviceModal from "./EditScramblingDeviceModal";

interface ScramblingDeviceRowProps {
    device: ScramblingDevice;
    fetchData: () => void;
}

const ScramblingDeviceRow = ({
    device,
    fetchData,
}: ScramblingDeviceRowProps) => {
    const toast = useToast();
    const confirm = useConfirm();
    const [isOpenEditDeviceModal, setIsOpenEditDeviceModal] =
        useState<boolean>(false);

    const handleCloseEditDeviceModal = async () => {
        fetchData();
        setIsOpenEditDeviceModal(false);
    };

    const handleDelete = async () => {
        confirm({
            title: "Delete scrambling device",
            description:
                "Are you sure you want to delete this device? This action cannot be undone",
        })
            .then(async () => {
                const status = await deleteScramblingDevice(device.id);
                if (status === 204) {
                    toast({
                        title: "Successfully deleted scrambling device.",
                        status: "success",
                    });
                    fetchData();
                } else {
                    toast({
                        title: "Error",
                        description: "Something went wrong",
                        status: "error",
                    });
                }
            })
            .catch(() => {
                toast({
                    title: "Cancelled",
                    description:
                        "You have cancelled the deletion of the device.",
                    status: "info",
                });
            });
    };

    return (
        <>
            <Tr key={device.id}>
                <Td>{device.name}</Td>
                <Td>{device.room.name}</Td>
                <Td>
                    <EditButton
                        onClick={() => setIsOpenEditDeviceModal(true)}
                    />
                    <DeleteButton onClick={handleDelete} />
                </Td>
            </Tr>
            <EditScramblingDeviceModal
                isOpen={isOpenEditDeviceModal}
                onClose={handleCloseEditDeviceModal}
                device={device}
            />
        </>
    );
};

export default ScramblingDeviceRow;
