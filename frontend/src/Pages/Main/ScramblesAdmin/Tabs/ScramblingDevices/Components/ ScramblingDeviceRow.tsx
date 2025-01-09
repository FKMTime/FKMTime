import { Td, Tr, useToast } from "@chakra-ui/react";
import { useConfirm } from "chakra-ui-confirm";
import { useState } from "react";
import { PiTimerDuotone } from "react-icons/pi";

import DeleteButton from "@/Components/DeleteButton";
import EditButton from "@/Components/EditButton";
import SmallIconButton from "@/Components/SmallIconButton";
import { ScramblingDevice } from "@/lib/interfaces";
import { deleteScramblingDevice } from "@/lib/scramblingDevices";

import EditScramblingDeviceModal from "./EditScramblingDeviceModal";
import OneTimeCodeModal from "./OneTimeCodeModal";

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
    const [isOpenOneTimeCodeModal, setIsOpenOneTimeCodeModal] =
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
                        
                    });
                    fetchData();
                } else {
                    toast({
                        title: "Error",
                        description: "Something went wrong",
                        variant: "destructive",
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
            <TableRow key={device.id}>
                <TableCell>{device.name}</TableCell>
                <TableCell>{device.room.name}</TableCell>
                <TableCell>
                    <SmallIconButton
                        title={"Generate one time code"}
                        icon={<PiTimerDuotone />}
                        onClick={() => setIsOpenOneTimeCodeModal(true)}
                    />
                    <EditButton
                        onClick={() => setIsOpenEditDeviceModal(true)}
                    />
                    <DeleteButton onClick={handleDelete} />
                </TableCell>
            </TableRow>
            <EditScramblingDeviceModal
                isOpen={isOpenEditDeviceModal}
                onClose={handleCloseEditDeviceModal}
                device={device}
            />
            <OneTimeCodeModal
                isOpen={isOpenOneTimeCodeModal}
                onClose={() => setIsOpenOneTimeCodeModal(false)}
                device={device}
            />
        </>
    );
};

export default ScramblingDeviceRow;
