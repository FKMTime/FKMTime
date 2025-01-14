import { Event as IEvent } from "@wca/helpers";

import EventIcon from "@/Components/Icons/EventIcon";
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { activityCodeToName } from "@/lib/activities";
import { getEventName } from "@/lib/events";
import { numberToLetter } from "@/lib/utils";

interface EventCardProps {
    eventData: IEvent;
}

const EventCard = ({ eventData }: EventCardProps) => {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <EventIcon eventId={eventData.id} selected />
                    {getEventName(eventData.id)}
                </CardTitle>
            </CardHeader>
            <CardContent>
                {eventData.rounds.map((round) => (
                    <div key={round.id}>
                        <p>{activityCodeToName(round.id)}</p>
                        <ul className="list-disc pl-5">
                            {round.scrambleSets?.map((set, i: number) => (
                                <li key={set.id}>
                                    Set {numberToLetter(i + 1)} (
                                    {set.scrambles.length} scrambles,{" "}
                                    {set.extraScrambles.length} extra scrambles)
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
};

export default EventCard;
