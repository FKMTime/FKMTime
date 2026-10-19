import { Competition as WCIF } from "wcif-helpers";

import EventCard from "./EventCard";

interface ScrambleSetsListProps {
    wcif: WCIF;
}

const ScrambleSetsList = ({ wcif }: ScrambleSetsListProps) => {
    return (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[repeat(auto-fill,minmax(260px,1fr))]">
            {wcif.events.map((event) => (
                <EventCard key={event.id} eventData={event} />
            ))}
        </div>
    );
};

export default ScrambleSetsList;
