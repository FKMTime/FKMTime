import { getEventIconClass } from "@/lib/events";

interface EventIconProps {
    eventId: string;
    selected?: boolean;
    size?: number;
}

const EventIcon = ({ eventId, selected, size = 15 }: EventIconProps) => {
    const iconClass = getEventIconClass(eventId);
    return (
        <span
            className={`cubing-icon ${iconClass}`}
            style={{ opacity: selected ? 1 : 0.3, fontSize: size }}
        ></span>
    );
};

export default EventIcon;
