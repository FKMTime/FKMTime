import { activityCodeToName } from "@wca/helpers";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import EventIcon from "@/Components/Icons/EventIcon";
import { Button } from "@/Components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { Input } from "@/Components/ui/input";
import { ScrambleSet } from "@/lib/interfaces";

interface ScrambleSetHeaderCardProps {
    scrambleSet: ScrambleSet;
    isLocked: boolean;
    handleUnlock: (password: string) => void;
}

const ScrambleSetHeaderCard = ({
    scrambleSet,
    isLocked,
    handleUnlock,
}: ScrambleSetHeaderCardProps) => {
    const navigate = useNavigate();
    const [password, setPassword] = useState("");

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <EventIcon
                            size={20}
                            eventId={scrambleSet.roundId.split("-")[0]}
                            selected
                        />
                        {activityCodeToName(scrambleSet.roundId)} Set{" "}
                        {scrambleSet.set}
                    </div>
                    <Button onClick={() => navigate("/scrambling-device")}>
                        Home
                    </Button>
                </CardTitle>
            </CardHeader>
            {isLocked ? (
                <CardContent>
                    <div className="flex flex-col gap-3 w-fit">
                        <Input
                            value={password}
                            type="password"
                            autoFocus
                            placeholder="Password"
                            onChange={(e) => setPassword(e.target.value)}
                            autoComplete="off"
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    handleUnlock(password);
                                }
                            }}
                        />
                        <Button
                            variant="success"
                            onClick={() => handleUnlock(password)}
                        >
                            Unlock
                        </Button>
                    </div>
                </CardContent>
            ) : null}
        </Card>
    );
};

export default ScrambleSetHeaderCard;
