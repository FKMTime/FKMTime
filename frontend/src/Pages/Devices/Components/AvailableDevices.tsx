import { Box, Button, Flex, Heading, Text } from "@chakra-ui/react";
import { MdDevices } from "react-icons/md";

import { AvailableDevice } from "@/logic/interfaces";
import { prettyAvailableDeviceType } from "@/logic/utils";

interface AvailableDevicesProps {
    devices: AvailableDevice[];
    handleAddDeviceRequest: (device: AvailableDevice) => void;
    handleRemoveDeviceRequest: (deviceEspId: number) => void;
}

const AvailableDevices = ({
    devices,
    handleAddDeviceRequest,
    handleRemoveDeviceRequest,
}: AvailableDevicesProps) => {
    return (
        <Flex flexDirection="column" gap="2">
            <Heading size="lg">Available devices</Heading>
            <Text size="md">
                Press submit button on device you want to connect
            </Text>
            <Box
                display="flex"
                flexDirection="row"
                gap="5"
                flexWrap="wrap"
                justifyContent={{ base: "center", md: "flex-start" }}
            >
                {devices.map((device) => (
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
                        <Text>
                            Type: {prettyAvailableDeviceType(device.type)}
                        </Text>
                        <Button
                            colorScheme="green"
                            onClick={() => handleAddDeviceRequest(device)}
                        >
                            Add
                        </Button>
                        <Button
                            colorScheme="red"
                            onClick={() =>
                                handleRemoveDeviceRequest(device.espId)
                            }
                        >
                            Remove
                        </Button>
                    </Box>
                ))}
            </Box>
        </Flex>
    );
};

export default AvailableDevices;
