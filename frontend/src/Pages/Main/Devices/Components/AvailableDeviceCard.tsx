import { Box, Button, Text } from "@chakra-ui/react";
import { MdDevices } from "react-icons/md";

import { AvailableDevice } from "@/lib/interfaces";
import { prettyAvailableDeviceType } from "@/logic/utils";

interface AvailableDeviceCardProps {
    device: AvailableDevice;
    handleAddDeviceRequest: (device: AvailableDevice) => void;
    handleRemoveDeviceRequest: (deviceEspId: number) => void;
}
const AvailableDeviceCard = ({
    device,
    handleAddDeviceRequest,
    handleRemoveDeviceRequest,
}: AvailableDeviceCardProps) => {
    return (
        <Box
            key={device.espId}
            bg="gray.900"
            p="5"
            rounded="md"
            color="white"
            display="flex"
            flexDirection="column"
            gap="3"
            alignItems="center"
            justifyContent="center"
        >
            <MdDevices size={48} />
            <Text>Device ID: {device.espId}</Text>
            <Text>Type: {prettyAvailableDeviceType(device.type)}</Text>
            <Button
                colorScheme="green"
                onClick={() => handleAddDeviceRequest(device)}
            >
                Add
            </Button>
            <Button
                colorScheme="red"
                onClick={() => handleRemoveDeviceRequest(device.espId)}
            >
                Remove
            </Button>
        </Box>
    );
};

export default AvailableDeviceCard;
