import { Event as WCIFEvent } from "@wca/helpers";
import { useNavigate } from "react-router-dom";

import EventIcon from "@/Components/Icons/EventIcon";
import { Button } from "@/Components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { Competition } from "@/lib/interfaces";

interface InfoCardProps {
    competition: Competition;
}
const InfoCard = ({ competition }: InfoCardProps) => {
    const navigate = useNavigate();
    return (
        <Card className="h-full">
            <CardHeader className="flex flex-col gap-3">
                <CardTitle>{competition.name}</CardTitle>
                <div className="flex gap-3 w-full flex-wrap">
                    {competition.wcif.events.map((event: WCIFEvent) => (
                        <EventIcon
                            key={event.id}
                            eventId={event.id}
                            selected={true}
                            size={25}
                        />
                    ))}
                </div>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col gap-4">
                    <Button onClick={() => navigate("/incidents")}>
                        Incidents
                    </Button>
                    <Button
                        onClick={() => navigate("/competition?tab=rooms")}
                        variant="success"
                    >
                        Current groups
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
};

export default InfoCard;
