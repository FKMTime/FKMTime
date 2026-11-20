import { GraduationCap } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/Components/ui/alert";
import { Button } from "@/Components/ui/button";
import { useNow } from "@/hooks/useNow";
import { Device } from "@/lib/interfaces";
import { getTutorialStations } from "@/lib/tutorial";

interface TutorialStationsAlertProps {
    stations: Device[];
    /** Delegates only: ends tutorial mode on a station */
    onEnd?: (station: Device) => void;
}

/**
 * Stations in tutorial mode, whose solves aren't saved: the safety net for a
 * tutorial left on (SPEC-012)
 */
const TutorialStationsAlert = ({
    stations,
    onEnd,
}: TutorialStationsAlertProps) => {
    const now = useNow();
    const inTutorial = getTutorialStations(stations, now);
    if (inTutorial.length === 0) return null;

    return (
        <Alert variant="warning">
            <GraduationCap />
            <AlertTitle>
                {inTutorial.length === 1
                    ? `${inTutorial[0].name} is in tutorial mode`
                    : `${inTutorial.length} stations are in tutorial mode`}
            </AlertTitle>
            <AlertDescription>
                <p>Their solves aren't saved.</p>
                <ul className="mt-2 flex flex-col gap-1.5">
                    {inTutorial.map((station) => (
                        <li
                            key={station.id}
                            className="flex items-center justify-between gap-3"
                        >
                            <span className="font-semibold">
                                {station.name}
                            </span>
                            {onEnd && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => onEnd(station)}
                                >
                                    End tutorial
                                </Button>
                            )}
                        </li>
                    ))}
                </ul>
            </AlertDescription>
        </Alert>
    );
};

export default TutorialStationsAlert;
