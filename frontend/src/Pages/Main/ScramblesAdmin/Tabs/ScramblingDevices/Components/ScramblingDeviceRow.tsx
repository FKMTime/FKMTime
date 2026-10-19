import { KeyRound, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";

import RowActions from "@/Components/shared/RowActions";
import { useConfirm } from "@/hooks/useConfirm";
import { useToast } from "@/hooks/useToast";
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
    const { toast } = useToast();
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
                        variant: "success",
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
                });
            });
    };

    return (
        <li className="flex items-center gap-2.5 border-b py-2 pl-3.5 pr-1 last:border-b-0 md:py-2.5 md:pl-5 md:pr-3">
            <div className="flex min-w-0 flex-1 flex-col md:flex-row md:items-center md:gap-6">
                <span className="truncate text-[15px] font-semibold md:w-1/3 md:text-sm">
                    {device.name}
                </span>
                <span className="truncate text-[13px] text-muted-foreground md:text-sm">
                    {device.room.name}
                </span>
            </div>
            <RowActions
                subject={device.name}
                primary={{
                    label: "One-time login code",
                    icon: KeyRound,
                    onSelect: () => setIsOpenOneTimeCodeModal(true),
                }}
                items={[
                    {
                        label: "Edit",
                        icon: Pencil,
                        onSelect: () => setIsOpenEditDeviceModal(true),
                    },
                    {
                        label: "Delete device",
                        icon: Trash2,
                        destructive: true,
                        onSelect: handleDelete,
                    },
                ]}
            />
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
        </li>
    );
};

export default ScramblingDeviceRow;
