import { getEventIconClass, getEventName } from "@/lib/events";

import Tooltip from "../Tooltip";

interface EventIconProps {
    eventId: string;
    selected?: boolean;
    size?: number;
}

const EventIcon = ({ eventId, selected, size = 15 }: EventIconProps) => {
    const iconClass = getEventIconClass(eventId);
    return (
        <Tooltip content={getEventName(eventId) || ""}>
            <span
                className={`cubing-icon ${iconClass}`}
                style={{ opacity: selected ? 1 : 0.3, fontSize: size }}
            ></span>
        </Tooltip>
    );
};

export default EventIcon;
