import { useEffect, useRef, useState } from "react";

import useStationTimer from "@/hooks/useStationTimer";
import { activityCodeToName } from "@/lib/activities";
import { StationInfo, StationPhase } from "@/lib/liveSolving";
import { centisecondsToClockFormat } from "@/lib/resultFormatters";
import { cn } from "@/lib/utils";

import StationCard from "./StationCard";

const formatCs = (cs: number) => {
    try {
        return centisecondsToClockFormat(Math.max(0, cs));
    } catch {
        return "0.00";
    }
};

const getRoundLabel = (groupId: string) => {
    try {
        return activityCodeToName(groupId.split("-g")[0], true, true);
    } catch {
        return undefined;
    }
};

interface LiveStationCardProps {
    station: StationInfo;
    /** Show the station's round, for rooms running more than one */
    showRound?: boolean;
    /** Staff only: red border, badge and a one-off flash when it appears */
    hasIncident?: boolean;
    onPhaseChange?: (espId: number, phase: StationPhase) => void;
}

/** A station card fed by the live solving socket packets */
const LiveStationCard = ({
    station,
    showRound,
    hasIncident = false,
    onPhaseChange,
}: LiveStationCardProps) => {
    const { phase, displayTime, displayInspection } = useStationTimer(station);
    const [isFlashing, setIsFlashing] = useState(false);
    const hadIncident = useRef(false);

    useEffect(() => {
        if (hasIncident && !hadIncident.current) {
            setIsFlashing(true);
            const timeout = setTimeout(() => setIsFlashing(false), 1800);
            hadIncident.current = hasIncident;
            return () => clearTimeout(timeout);
        }
        hadIncident.current = hasIncident;
    }, [hasIncident]);

    useEffect(() => {
        onPhaseChange?.(station.espId, phase);
    }, [onPhaseChange, station.espId, phase]);

    // An offline station's last packet describes a solve that is long over
    const isOffline = phase === "offline";
    const time = phase === "inspection" ? displayInspection : displayTime;
    const hasCumulative =
        !isOffline &&
        station.cumulativeLimitCentiseconds != null &&
        station.cumulativeRemainingCentiseconds != null;

    return (
        <StationCard
            deviceName={station.deviceName}
            competitorName={isOffline ? null : station.personName}
            phase={phase}
            time={time != null ? formatCs(time) : null}
            roundLabel={
                showRound && !isOffline && station.groupId
                    ? getRoundLabel(station.groupId)
                    : undefined
            }
            cumulative={
                hasCumulative
                    ? {
                          remaining: formatCs(
                              station.cumulativeRemainingCentiseconds!
                          ),
                          limit: formatCs(station.cumulativeLimitCentiseconds!),
                      }
                    : null
            }
            hasIncident={hasIncident}
            className={cn(isFlashing && "incident-flash")}
        />
    );
};

export default LiveStationCard;
