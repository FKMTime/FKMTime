import { Box, Flex, Heading, Text } from "@chakra-ui/react";

import { AvailableDevice } from "@/logic/interfaces";

import AvailableDeviceCard from "./AvailableDeviceCard";

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
                    <AvailableDeviceCard
                        device={device}
                        handleAddDeviceRequest={handleAddDeviceRequest}
                        handleRemoveDeviceRequest={handleRemoveDeviceRequest}
                        key={device.espId}
                    />
                ))}
            </Box>
        </Flex>
    );
};

export default AvailableDevices;
