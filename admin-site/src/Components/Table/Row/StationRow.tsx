import { useState } from "react";
import { Tr, Td, IconButton, useToast } from "@chakra-ui/react";
import { MdEdit, MdDelete } from "react-icons/md";
import { Station } from "../../../logic/interfaces";
import Alert from "../../Alert"
import { deleteStation } from "../../../logic/station";
import EditStationModal from "../../Modal/EditStationModal";

interface StationRowProps {
    station: Station;
    fetchData: () => void;
}

const StationRow: React.FC<StationRowProps> = ({ station, fetchData }): JSX.Element => {

    const toast = useToast();
    const [openConfirmation, setOpenConfirmation] = useState<boolean>(false);
    const [isOpenEditStationModal, setIsOpenEditStationModal] = useState<boolean>(false);

    const handleDelete = async () => {
        setOpenConfirmation(true);
    };

    const handleCancel = () => {
        setOpenConfirmation(false);
    };

    const handleCloseEditStationModal = async () => {
        await fetchData();
        setIsOpenEditStationModal(false);
    };

    const handleConfirm = async () => {
        setOpenConfirmation(false);
        const status = await deleteStation(station.id);
        if (status === 204) {
            toast({
                title: "Successfully deleted station.",
                status: "success",
                duration: 9000,
                isClosable: true,
            });
            fetchData();
        } else {
            toast({
                title: "Error",
                description: "Something went wrong",
                status: "error",
                duration: 9000,
                isClosable: true,
            });
        }
    };

    return (
        <>
            <Tr key={station.id}>
                <Td>{station.id}</Td>
                <Td>{station.name}</Td>
                <Td>{station.espId}</Td>
                <Td>
                    <IconButton icon={<MdEdit />} aria-label="Edit" bg="none" color="white" _hover={{
                        background: "none",
                        color: "gray.400"
                    }}
                        onClick={() => setIsOpenEditStationModal(true)}
                    />
                    <IconButton icon={<MdDelete />} aria-label="Delete" bg="none" color="white" _hover={{
                        background: "none",
                        color: "gray.400"
                    }}
                        onClick={handleDelete}
                    />

                </Td>
            </Tr>
            <Alert isOpen={openConfirmation} onCancel={handleCancel} onConfirm={handleConfirm} title="Delete station" description="Are you sure?" />
            <EditStationModal isOpen={isOpenEditStationModal} onClose={handleCloseEditStationModal} station={station} />
        </>
    )
};

export default StationRow;
