import { GraduationCap } from "lucide-react";

import { StatusBadge } from "@/Components/shared/StatusBadge";
import { Button } from "@/Components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/Components/ui/popover";
import { useNow } from "@/hooks/useNow";
import { Device } from "@/lib/interfaces";
import { formatClockTime } from "@/lib/time";
import { isInTutorial, TUTORIAL_QUIET_MINUTES } from "@/lib/tutorial";

interface TutorialStationBadgeProps {
    device: Device;
    /** Delegates only: ends tutorial mode on the station */
    onEnd?: () => void;
}

/**
 * Marks a station in tutorial mode, whose solves aren't saved (SPEC-012).
 * It disappears on its own once the mode's end has passed
 */
const TutorialStationBadge = ({ device, onEnd }: TutorialStationBadgeProps) => {
    const now = useNow();
    if (!isInTutorial(device, now) || !device.tutorialEndsAt) return null;

    return (
        <Popover>
            <PopoverTrigger
                type="button"
                className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
                <StatusBadge tone="primary">
                    <GraduationCap aria-hidden />
                    Tutorial
                </StatusBadge>
            </PopoverTrigger>
            {/* Rendered inside the name cell: reset its no-wrap and bold */}
            <PopoverContent
                align="start"
                collisionPadding={12}
                className="flex flex-col gap-2 whitespace-normal text-sm font-normal"
            >
                <p className="font-semibold">
                    Solves on this station aren't saved.
                </p>
                <p className="text-muted-foreground">
                    It ends on its own {TUTORIAL_QUIET_MINUTES} min after the
                    last tutorial solve (now about{" "}
                    {formatClockTime(device.tutorialEndsAt)}), or when the
                    room's first group of the day starts.
                    {device.tutorialStartedBy &&
                        ` Started by ${device.tutorialStartedBy.fullName}.`}
                </p>
                {onEnd && (
                    <Button size="sm" variant="outline" onClick={onEnd}>
                        End tutorial
                    </Button>
                )}
            </PopoverContent>
        </Popover>
    );
};

export default TutorialStationBadge;
