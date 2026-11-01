import { FormEvent, useState } from "react";

import PenaltySelect from "@/Components/PenaltySelect";
import SwitchRow from "@/Components/shared/SwitchRow";
import { Button } from "@/Components/ui/button";
import { Input } from "@/Components/ui/input";
import { Label } from "@/Components/ui/label";
import { getGroupLabel } from "@/lib/currentGroups";
import { Device, Person, Room } from "@/lib/interfaces";
import {
    AttemptFormValues,
    buildAttemptPacket,
    generateSessionId,
} from "@/lib/stationTester";

import PersonCardField from "./PersonCardField";
import PickOrTypeField from "./PickOrTypeField";

interface EnterAttemptFormProps {
    persons: Person[];
    deviceOptions: { value: string; label: string }[];
    devices: Device[];
    rooms: Room[];
    getCard: (person: Person) => Promise<string>;
    onSend: (type: string, data: unknown) => Promise<unknown>;
    isSending: boolean;
}

const EnterAttemptForm = ({
    persons,
    deviceOptions,
    devices,
    rooms,
    getCard,
    onSend,
    isSending,
}: EnterAttemptFormProps) => {
    const [values, setValues] = useState<AttemptFormValues>(() => ({
        timeMs: "10300",
        penalty: 0,
        inspectionTimeMs: "5000",
        competitorCard: "",
        judgeCard: "",
        espId: deviceOptions[0]?.value ?? "",
        groupId: "",
        sessionId: generateSessionId(),
        solvedAt: "",
        isDelegate: false,
    }));
    const [newSessionEachSend, setNewSessionEachSend] = useState(true);

    const update = (changes: Partial<AttemptFormValues>) =>
        setValues((previous) => ({ ...previous, ...changes }));

    const device = devices.find((d) => d.espId.toString() === values.espId);
    const room = rooms.find((r) => r.id === device?.roomId);
    const groupOptions = (room?.currentGroupIds ?? []).map((groupId) => ({
        value: groupId,
        label: getGroupLabel(groupId),
    }));

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        await onSend("EnterAttempt", buildAttemptPacket(values));
        if (newSessionEachSend) update({ sessionId: generateSessionId() });
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <PersonCardField
                label="Competitor card"
                persons={persons}
                value={values.competitorCard}
                onChange={(competitorCard) => update({ competitorCard })}
                getCard={getCard}
                required
            />
            <PersonCardField
                label="Judge card"
                persons={persons}
                value={values.judgeCard}
                onChange={(judgeCard) => update({ judgeCard })}
                getCard={getCard}
            />
            <PickOrTypeField
                label="Station ESP ID"
                options={deviceOptions}
                value={values.espId}
                onChange={(espId) => update({ espId })}
                placeholder="Select station"
                inputType="number"
                required
            />
            <PickOrTypeField
                label="Group"
                options={groupOptions}
                value={values.groupId}
                onChange={(groupId) => update({ groupId })}
                placeholder="The station's current group"
            />
            <div className="grid gap-4 sm:grid-cols-3">
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="stationTesterTime">Time (ms)</Label>
                    <Input
                        id="stationTesterTime"
                        type="number"
                        value={values.timeMs}
                        onChange={(event) =>
                            update({ timeMs: event.target.value })
                        }
                        required
                    />
                </div>
                <div className="flex flex-col gap-1.5">
                    <Label>Penalty</Label>
                    <PenaltySelect
                        aria-label="Penalty"
                        value={values.penalty}
                        onChange={(penalty) => update({ penalty })}
                    />
                </div>
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="stationTesterInspection">
                        Inspection (ms)
                    </Label>
                    <Input
                        id="stationTesterInspection"
                        type="number"
                        value={values.inspectionTimeMs}
                        onChange={(event) =>
                            update({ inspectionTimeMs: event.target.value })
                        }
                        required
                    />
                </div>
            </div>
            <div className="flex flex-col gap-1.5">
                <Label htmlFor="stationTesterSession">Session ID</Label>
                <Input
                    id="stationTesterSession"
                    value={values.sessionId}
                    onChange={(event) =>
                        update({ sessionId: event.target.value })
                    }
                    required
                />
            </div>
            <div className="flex flex-col gap-1.5">
                <Label htmlFor="stationTesterSolvedAt">Solved at</Label>
                <Input
                    id="stationTesterSolvedAt"
                    value={values.solvedAt}
                    onChange={(event) =>
                        update({ solvedAt: event.target.value })
                    }
                    placeholder="Now"
                />
            </div>
            <div>
                <SwitchRow
                    label="New session ID after each send"
                    description="Turn off to send the same attempt twice."
                    checked={newSessionEachSend}
                    onCheckedChange={setNewSessionEachSend}
                />
                <SwitchRow
                    label="Delegate called"
                    checked={values.isDelegate}
                    onCheckedChange={(isDelegate) => update({ isDelegate })}
                />
            </div>
            <Button type="submit" disabled={isSending}>
                Send attempt
            </Button>
        </form>
    );
};

export default EnterAttemptForm;
