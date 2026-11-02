import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import LoadingPage from "@/Components/LoadingPage";
import SegmentedControl from "@/Components/shared/SegmentedControl";
import { Button } from "@/Components/ui/button";
import { Card, CardContent } from "@/Components/ui/card";
import { useToast } from "@/hooks/useToast";
import { getAllDevices, sortDevicesByName } from "@/lib/devices";
import { Device, DeviceType, Person, Room } from "@/lib/interfaces";
import { assignCard, getAllPersons } from "@/lib/persons";
import { getAllRooms } from "@/lib/rooms";
import {
    generateCardId,
    hasCard,
    sendStationPacket,
    StationExchange,
} from "@/lib/stationTester";

import CardScanForm from "./Components/CardScanForm";
import ConnectDeviceForm from "./Components/ConnectDeviceForm";
import EnterAttemptForm from "./Components/EnterAttemptForm";
import ExchangePanel from "./Components/ExchangePanel";

type StationTesterTab = "attempt" | "card" | "connect";

const TABS: { value: StationTesterTab; label: string }[] = [
    { value: "attempt", label: "Enter attempt" },
    { value: "card", label: "Scan card" },
    { value: "connect", label: "Connect device" },
];

/** Plays a station in dev, so a flow can be tried without the hardware */
const StationTester = () => {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [tab, setTab] = useState<StationTesterTab>("attempt");
    const [persons, setPersons] = useState<Person[]>([]);
    const [devices, setDevices] = useState<Device[]>([]);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [exchange, setExchange] = useState<StationExchange | null>(null);
    const [isSending, setIsSending] = useState<boolean>(false);

    const fetchData = useCallback(async () => {
        const [personsData, devicesData, roomsData] = await Promise.all([
            getAllPersons(),
            getAllDevices(DeviceType.STATION),
            getAllRooms(),
        ]);
        setPersons(personsData);
        setDevices(sortDevicesByName(devicesData));
        setRooms(roomsData);
        setIsLoading(false);
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const getCard = async (picked: Person) => {
        // The picker holds on to the list it was given, which may be outdated
        const person = persons.find((p) => p.id === picked.id) ?? picked;
        if (hasCard(person.cardId)) return person.cardId!;

        const cardId = generateCardId();
        const status = await assignCard(person.id, cardId);
        if (status !== 200) {
            toast({
                title: `Couldn't give ${person.name} a card`,
                variant: "destructive",
            });
            return "";
        }
        setPersons((previous) =>
            previous.map((p) => (p.id === person.id ? { ...p, cardId } : p))
        );
        toast({ title: `${person.name} now has card ${cardId}` });
        return cardId;
    };

    const handleSend = async (type: string, data: unknown) => {
        setExchange(null);
        setIsSending(true);
        setExchange(await sendStationPacket(type, data));
        setIsSending(false);
    };

    if (isLoading) return <LoadingPage />;

    const deviceOptions = devices.map((device) => ({
        value: device.espId.toString(),
        label: device.name,
    }));

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
                <SegmentedControl
                    label="Message to send"
                    options={TABS}
                    value={tab}
                    onValueChange={setTab}
                />
                <Button
                    variant="outline"
                    size="icon"
                    aria-label="Reload people and devices"
                    onClick={fetchData}
                >
                    <RefreshCw />
                </Button>
            </div>
            <div className="grid items-start gap-4 lg:grid-cols-2">
                <Card>
                    <CardContent className="pt-4 md:pt-5">
                        {/* Stay mounted, so switching tabs keeps what was typed */}
                        <div hidden={tab !== "attempt"}>
                            <EnterAttemptForm
                                persons={persons}
                                deviceOptions={deviceOptions}
                                devices={devices}
                                rooms={rooms}
                                getCard={getCard}
                                onSend={handleSend}
                                isSending={isSending}
                            />
                        </div>
                        <div hidden={tab !== "card"}>
                            <CardScanForm
                                persons={persons}
                                deviceOptions={deviceOptions}
                                getCard={getCard}
                                onSend={handleSend}
                                isSending={isSending}
                            />
                        </div>
                        <div hidden={tab !== "connect"}>
                            <ConnectDeviceForm
                                onSend={handleSend}
                                isSending={isSending}
                            />
                        </div>
                    </CardContent>
                </Card>
                <ExchangePanel exchange={exchange} isSending={isSending} />
            </div>
        </div>
    );
};

export default StationTester;
