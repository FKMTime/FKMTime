import { getEventIconClass, getEventName } from "@/lib/events";

import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "../ui/tooltip";

interface EventIconProps {
    eventId: string;
    selected?: boolean;
    size?: number;
}

const EventIcon = ({ eventId, selected, size = 15 }: EventIconProps) => {
    const iconClass = getEventIconClass(eventId);
    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger>
                    <span
                        className={`cubing-icon ${iconClass}`}
                        style={{ opacity: selected ? 1 : 0.3, fontSize: size }}
                    ></span>
                </TooltipTrigger>
                <TooltipContent>
                    <p>{getEventName(eventId)}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
};

export default EventIcon;
