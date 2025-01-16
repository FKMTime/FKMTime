import { Competition as WCIF } from "@wca/helpers";

import EventCard from "./EventCard";

interface ScrambleSetsListProps {
    wcif: WCIF;
}

const ScrambleSetsList = ({ wcif }: ScrambleSetsListProps) => {
    return (
        <div className="flex flex-row flex-wrap gap-5">
            {wcif.events.map((event) => (
                <EventCard key={event.id} eventData={event} />
            ))}
        </div>
    );
};

export default ScrambleSetsList;
