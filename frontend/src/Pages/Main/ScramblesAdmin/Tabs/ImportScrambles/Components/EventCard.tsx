import { Event as IEvent } from "wcif-helpers";

import { activityCodeToName } from "@/lib/activities";
import { getEventIconClass, getEventName } from "@/lib/events";
import { cn, numberToLetter } from "@/lib/utils";

interface EventCardProps {
    eventData: IEvent;
}

const EventCard = ({ eventData }: EventCardProps) => {
    return (
        <section className="flex flex-col gap-3 rounded-mobile-card border bg-card p-4 md:rounded-2xl">
            <h3 className="flex items-center gap-2 text-[15px] font-semibold">
                <span
                    aria-hidden
                    className={cn(
                        "cubing-icon text-lg",
                        getEventIconClass(eventData.id)
                    )}
                />
                {getEventName(eventData.id)}
            </h3>
            {eventData.rounds.map((round) => (
                <div key={round.id} className="flex flex-col gap-1">
                    <p className="text-[13px] font-semibold text-muted-foreground">
                        {activityCodeToName(round.id)}
                    </p>
                    <ul className="flex flex-col gap-0.5 text-sm">
                        {round.scrambleSets?.map((set, i: number) => (
                            <li key={set.id}>
                                Set {numberToLetter(i + 1)} ·{" "}
                                {set.scrambles.length} scrambles ·{" "}
                                {set.extraScrambles.length} extra
                            </li>
                        ))}
                    </ul>
                </div>
            ))}
        </section>
    );
};

export default EventCard;
