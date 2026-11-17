import { GraduationCap, X } from "lucide-react";
import { useState } from "react";
import { Competition as WCIF } from "wcif-helpers";

import { Alert, AlertDescription, AlertTitle } from "@/Components/ui/alert";
import { Button } from "@/Components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/Components/ui/dropdown-menu";
import { useNow } from "@/hooks/useNow";
import { Device, DeviceType, Room } from "@/lib/interfaces";
import { formatTimeRange } from "@/lib/schedule";
import {
    getUpcomingTutorials,
    isInTutorial,
    ScheduledTutorial,
} from "@/lib/tutorial";

const DEFAULT_NAME = "Tutorial for new competitors";

const dismissedKey = (tutorial: ScheduledTutorial) =>
    `tutorialSuggestionDismissed:${tutorial.key}`;

interface TutorialSuggestionProps {
    wcif: WCIF;
    rooms: Room[];
    stations: Device[];
    /** Delegates only: starts tutorial mode on a station */
    onStart?: (station: Device) => void;
}

/**
 * Suggests starting tutorial mode around the schedule's tutorial (SPEC-012).
 * The first of the actions Home suggests; what suggestions share gets pulled
 * out when the second one arrives
 */
const TutorialSuggestion = ({
    wcif,
    rooms,
    stations,
    onStart,
}: TutorialSuggestionProps) => {
    const now = useNow();
    const [dismissed, setDismissed] = useState<string[]>([]);

    const active = stations.filter(
        (s) => s.type === DeviceType.STATION && !s.retiredAt
    );
    const stationsIn = (tutorial: ScheduledTutorial) => {
        const roomId = rooms.find((r) => r.name === tutorial.roomName)?.id;
        return active.filter((s) => s.roomId === roomId);
    };
    const tutorials = getUpcomingTutorials(wcif, now).filter(
        (tutorial) =>
            !dismissed.includes(tutorial.key) &&
            localStorage.getItem(dismissedKey(tutorial)) === null &&
            !stationsIn(tutorial).some((s) => isInTutorial(s, now))
    );
    if (tutorials.length === 0) return null;

    const dismiss = (tutorial: ScheduledTutorial) => {
        localStorage.setItem(dismissedKey(tutorial), "1");
        setDismissed((keys) => [...keys, tutorial.key]);
    };

    return (
        <>
            {tutorials.map((tutorial) => {
                const inRoom = stationsIn(tutorial);
                // A room with no stations of its own: any station will do
                const choices = inRoom.length > 0 ? inRoom : active;
                return (
                    <Alert key={tutorial.key}>
                        <GraduationCap />
                        <AlertTitle className="flex items-start justify-between gap-2">
                            <span>
                                {tutorial.name || DEFAULT_NAME},{" "}
                                {tutorial.roomName},{" "}
                                {formatTimeRange(
                                    tutorial.startTime,
                                    tutorial.endTime,
                                    tutorial.timezone
                                )}
                            </span>
                            <button
                                type="button"
                                aria-label="Dismiss"
                                className="text-muted-foreground hover:text-foreground"
                                onClick={() => dismiss(tutorial)}
                            >
                                <X className="size-4" />
                            </button>
                        </AlertTitle>
                        <AlertDescription className="flex flex-col items-start gap-2">
                            <p>
                                Put a station in tutorial mode so newcomers can
                                try a solve. Nothing they do is saved.
                            </p>
                            {onStart && choices.length === 1 && (
                                <Button
                                    size="sm"
                                    onClick={() => onStart(choices[0])}
                                >
                                    Start tutorial on {choices[0].name}
                                </Button>
                            )}
                            {onStart && choices.length > 1 && (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button size="sm">
                                            Start tutorial
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start">
                                        {choices.map((station) => (
                                            <DropdownMenuItem
                                                key={station.id}
                                                onSelect={() =>
                                                    onStart(station)
                                                }
                                            >
                                                {station.name}
                                            </DropdownMenuItem>
                                        ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )}
                        </AlertDescription>
                    </Alert>
                );
            })}
        </>
    );
};

export default TutorialSuggestion;
