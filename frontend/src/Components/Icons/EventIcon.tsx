interface EventIconProps {
    eventId: string;
    selected?: boolean;
    size?: number;
}

const EventIcon = ({ eventId, selected, size = 15 }: EventIconProps) => {
    return (
        <span
            className={`cubing-icon event-${eventId}`}
            style={{ opacity: selected ? 1 : 0.3, fontSize: size }}
        ></span>
    );
};

export default EventIcon;
