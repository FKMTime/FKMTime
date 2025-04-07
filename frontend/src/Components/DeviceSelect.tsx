import { useEffect, useState } from "react";

import { getAllDevices } from "@/lib/devices";
import { Device, DeviceType } from "@/lib/interfaces";

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
    const [devices, setDevices] = useState<Device[]>([]);

    useEffect(() => {
        getAllDevices(DeviceType.STATION).then((data) => {
            setDevices(data);
        });
    }, []);

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
