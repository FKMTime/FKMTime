import { useAtomValue } from "jotai";
import { useState } from "react";

import { Modal } from "@/Components/Modal";
import ModalActions from "@/Components/ModalActions";
import { Button } from "@/Components/ui/button";
import { Checkbox } from "@/Components/ui/checkbox";
import { useDialogError } from "@/hooks/useDialogError";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { useToast } from "@/hooks/useToast";
import { activityCodeToName } from "@/lib/activities";
import { competitionAtom } from "@/lib/atoms";
import {
    devicesQuery,
    joinNames,
    runDifferentRoundSummary,
    setStationsRound,
    sortDevicesByName,
} from "@/lib/devices";
import { Device, DeviceType } from "@/lib/interfaces";
import { roomsQuery } from "@/lib/rooms";
import { getLiveRoundIds } from "@/lib/roundOptions";

import RoundPicker from "./RoundPicker";

interface RunDifferentRoundModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** Stations ticked when it opens */
    initialStationIds?: string[];
    /** Round chosen when it opens, e.g. from a result that needs a redo */
    initialRoundId?: string;
}

/** Points one or more stations at a round, apart from their room (SPEC-007) */
const RunDifferentRoundModal = ({
    isOpen,
    onClose,
    initialStationIds = [],
    initialRoundId = "",
}: RunDifferentRoundModalProps) => {
    const [error, setError] = useDialogError(isOpen);
    return (
        <Modal
            error={error}
            isOpen={isOpen}
            onClose={onClose}
            title="Run a different round"
        >
            {/* Mounted only while open, so it starts from the opener's choice */}
            {isOpen && (
                <RunDifferentRoundForm
                    initialStationIds={initialStationIds}
                    initialRoundId={initialRoundId}
                    onDone={onClose}
                    onError={setError}
                />
            )}
        </Modal>
    );
};

interface RunDifferentRoundFormProps {
    initialStationIds: string[];
    initialRoundId: string;
    onDone: () => void;
    onError: (error: string) => void;
}

const RunDifferentRoundForm = ({
    initialStationIds,
    initialRoundId,
    onDone,
    onError,
}: RunDifferentRoundFormProps) => {
    const competition = useAtomValue(competitionAtom);
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [roundId, setRoundId] = useState(initialRoundId);
    const [stationIds, setStationIds] = useState<string[]>(initialStationIds);
    const { data: devices = [] } = useLiveQuery(devicesQuery);
    const { data: rooms = [] } = useLiveQuery(roomsQuery);

    const stations = sortDevicesByName(
        devices.filter(
            (device: Device) =>
                device.type === DeviceType.STATION && !device.retiredAt
        )
    );
    const roomsWithStations = rooms
        .map((room) => ({
            ...room,
            stations: stations.filter((s) => s.roomId === room.id),
        }))
        .filter((room) => room.stations.length > 0);
    const chosenNames = stations
        .filter((s) => stationIds.includes(s.id))
        .map((s) => s.name);

    const toggle = (id: string, checked: boolean) =>
        setStationIds((ids) =>
            checked ? [...ids, id] : ids.filter((other) => other !== id)
        );

    const handleSubmit = async () => {
        setIsLoading(true);
        const status = await setStationsRound(stationIds, roundId);
        setIsLoading(false);
        if (status === 200) {
            toast({
                title: `${joinNames(chosenNames)} now running ${activityCodeToName(roundId)}`,
                variant: "success",
            });
            onDone();
        } else if (status === 403) {
            onError("Only a delegate can change which round a station runs");
        } else {
            onError("Something went wrong");
        }
    };

    return (
        <>
            <fieldset className="flex min-w-0 flex-col gap-1.5">
                <legend className="mb-1.5 text-sm font-medium">Round</legend>
                {competition && (
                    <RoundPicker
                        wcif={competition.wcif}
                        liveRoundIds={getLiveRoundIds(rooms)}
                        value={roundId}
                        onValueChange={setRoundId}
                    />
                )}
            </fieldset>
            <fieldset className="flex flex-col gap-3">
                <legend className="mb-1.5 text-sm font-medium">Stations</legend>
                {roomsWithStations.map((room) => (
                    <div key={room.id} className="flex flex-col gap-2">
                        {roomsWithStations.length > 1 && (
                            <span className="text-xs font-semibold text-muted-foreground">
                                {room.name}
                            </span>
                        )}
                        {room.stations.map((station) => (
                            <label
                                key={station.id}
                                className="flex items-center gap-2.5 text-sm"
                            >
                                <Checkbox
                                    checked={stationIds.includes(station.id)}
                                    onCheckedChange={(checked) =>
                                        toggle(station.id, checked === true)
                                    }
                                />
                                {station.name}
                                {station.customRoundId && (
                                    <span className="text-xs text-muted-foreground">
                                        · now{" "}
                                        {activityCodeToName(
                                            station.customRoundId
                                        )}
                                    </span>
                                )}
                            </label>
                        ))}
                    </div>
                ))}
            </fieldset>
            {roundId && chosenNames.length > 0 && (
                <p className="text-sm text-muted-foreground">
                    {runDifferentRoundSummary(chosenNames, roundId)}
                </p>
            )}
            <ModalActions>
                <Button
                    onClick={handleSubmit}
                    disabled={isLoading || !roundId || stationIds.length === 0}
                >
                    Run this round
                </Button>
            </ModalActions>
        </>
    );
};

export default RunDifferentRoundModal;
