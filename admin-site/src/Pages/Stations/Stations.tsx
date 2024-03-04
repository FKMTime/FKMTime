import { useEffect, useState } from "react";
import { getAllStations } from "../../logic/station";
import LoadingPage from "../../Components/LoadingPage";
import { Station } from "../../logic/interfaces";
import { Box, IconButton } from "@chakra-ui/react";
import { MdAdd } from "react-icons/md";
import CreateStationModal from "../../Components/Modal/CreateStationModal";
import StationsTable from "../../Components/Table/StationsTable";

const Stations = (): JSX.Element => {
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [stations, setStations] = useState<Station[]>([]);
    const [isOpenCreateStationModal, setIsOpenCreateStationModal] =
        useState<boolean>(false);

    const fetchData = async () => {
        setIsLoading(true);
        const data = await getAllStations();
        setStations(data);
        setIsLoading(false);
    };

    const handleCloseCreateStationModal = async () => {
        await fetchData();
        setIsOpenCreateStationModal(false);
    };

    useEffect(() => {
        fetchData();
    }, []);

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
                onClick={() => setIsOpenCreateStationModal(true)}
            />
            <StationsTable stations={stations} fetchData={fetchData} />
            <CreateStationModal
                isOpen={isOpenCreateStationModal}
                onClose={handleCloseCreateStationModal}
            />
        </Box>
    );
};

export default Stations;
