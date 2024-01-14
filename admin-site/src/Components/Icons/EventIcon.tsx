interface EventIconProps {
    eventId: string;
    selected?: boolean;
}

const EventIcon: React.FC<EventIconProps> = ({ eventId, selected }): JSX.Element => {
    return <span className={`cubing-icon event-${eventId}`} style={{ opacity: selected ? 1 : 0.3 }}></span>;
};

export default EventIcon;
