interface EventIconProps {
    eventId: string;
    selected?: boolean;
    size?: number;
}

const EventIcon: React.FC<EventIconProps> = ({
    eventId,
    selected,
    size = 15,
}): JSX.Element => {
    return (
        <span
            className={`cubing-icon event-${eventId}`}
            style={{ opacity: selected ? 1 : 0.3, fontSize: size }}
        ></span>
    );
};

export default EventIcon;
