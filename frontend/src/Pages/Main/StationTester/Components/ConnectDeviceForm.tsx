import { FormEvent, useState } from "react";

import { Button } from "@/Components/ui/button";
import { Input } from "@/Components/ui/input";
import { Label } from "@/Components/ui/label";
import { AvailableDeviceType, HardwareVersion } from "@/lib/interfaces";
import {
    buildConnectDevicePacket,
    ConnectDeviceFormValues,
    generateEspId,
    generateSignKey,
} from "@/lib/stationTester";

import PickOrTypeField from "./PickOrTypeField";

const TYPE_OPTIONS = [
    { value: AvailableDeviceType.STATION, label: "Station" },
    {
        value: AvailableDeviceType.STAFF_ATTENDANCE,
        label: "Staff attendance device",
    },
];
const HARDWARE_OPTIONS = Object.values(HardwareVersion).map((version) => ({
    value: version,
    label: version,
}));

interface ConnectDeviceFormProps {
    onSend: (type: string, data: unknown) => Promise<unknown>;
    isSending: boolean;
}

const ConnectDeviceForm = ({ onSend, isSending }: ConnectDeviceFormProps) => {
    const [values, setValues] = useState<ConnectDeviceFormValues>(() => ({
        espId: generateEspId(),
        signKey: generateSignKey(),
        type: AvailableDeviceType.STATION,
        hw: HardwareVersion.V4,
    }));

    const update = (changes: Partial<ConnectDeviceFormValues>) =>
        setValues((previous) => ({ ...previous, ...changes }));

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        await onSend(
            "RequestToConnectDevice",
            buildConnectDevicePacket(values)
        );
        update({ espId: generateEspId(), signKey: generateSignKey() });
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <PickOrTypeField
                label="Device type"
                options={TYPE_OPTIONS}
                value={values.type}
                onChange={(type) => update({ type })}
                placeholder="Select type"
                required
            />
            <PickOrTypeField
                label="Hardware version"
                options={HARDWARE_OPTIONS}
                value={values.hw}
                onChange={(hw) => update({ hw })}
                placeholder="Select version"
                required
            />
            <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="stationTesterNewEspId">ESP ID</Label>
                    <Input
                        id="stationTesterNewEspId"
                        type="number"
                        value={values.espId}
                        onChange={(event) =>
                            update({ espId: event.target.value })
                        }
                        required
                    />
                </div>
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="stationTesterSignKey">Sign key</Label>
                    <Input
                        id="stationTesterSignKey"
                        type="number"
                        value={values.signKey}
                        onChange={(event) =>
                            update({ signKey: event.target.value })
                        }
                        required
                    />
                </div>
            </div>
            <Button type="submit" disabled={isSending}>
                Request to connect
            </Button>
        </form>
    );
};

export default ConnectDeviceForm;
