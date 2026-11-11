import { useLiveQuery } from "@/hooks/useLiveQuery";
import { stationDevicesQuery } from "@/lib/devices";
import { Device } from "@/lib/interfaces";

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "./ui/select";

interface DeviceSelectProps {
    value?: string;
    onChange: (value: string) => void;
    disabled?: boolean;
}

const DeviceSelect = ({
    value,
    onChange,
    disabled = false,
}: DeviceSelectProps) => {
    const { data } = useLiveQuery(stationDevicesQuery);
    const devices: Device[] = data ?? [];

    return (
        <Select
            onValueChange={onChange}
            defaultValue={value}
            disabled={disabled}
        >
            <SelectTrigger>
                <SelectValue placeholder="Select device" />
            </SelectTrigger>
            <SelectContent>
                {devices.map((device) => (
                    <SelectItem key={device.id} value={device.id}>
                        {device.name}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
};

export default DeviceSelect;
