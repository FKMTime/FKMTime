import { useNavigate } from "react-router-dom";

import { Button } from "@/Components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { activityCodeToName } from "@/lib/activities";

interface ResultsCardProps {
    currentRounds: string[];
}
const ResultsCard = ({ currentRounds }: ResultsCardProps) => {
    const navigate = useNavigate();
    return (
        <Card className="md:row-span-2">
            <CardHeader className="flex flex-col gap-3">
                <CardTitle>Results</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex flex-wrap gap-2">
                    {currentRounds.map((roundId) => (
                        <Button
                            key={roundId}
                            onClick={() => {
                                navigate(`/results/round/${roundId}`);
                            }}
                        >
                            {activityCodeToName(roundId)}
                        </Button>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
};

export default ResultsCard;
