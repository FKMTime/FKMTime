import { useAtomValue } from "jotai";
import { useState } from "react";
import { Activity } from "wcif-helpers";

import { Button } from "@/Components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/Components/ui/select";
import { useToast } from "@/hooks/useToast";
import { activityCodeToName, getGroupsByRoundId } from "@/lib/activities";
import { competitionAtom } from "@/lib/atoms";
import { placeInGroup } from "@/lib/integratedLive";

interface GroupPlacementProps {
    roundId: string;
    personId: string;
    name: string;
    suggestedGroupId?: string | null;
}

/**
 * One click to put someone with no group in the round into one, e.g. a
 * replacement. They can compete without it, but the group lists and
 * attendance wouldn't show them (SPEC-006 section 4).
 */
const GroupPlacement = ({
    roundId,
    personId,
    name,
    suggestedGroupId,
}: GroupPlacementProps) => {
    const competition = useAtomValue(competitionAtom);
    const { toast } = useToast();
    const groups: Activity[] = competition?.wcif
        ? getGroupsByRoundId(roundId, competition.wcif)
        : [];
    const [groupId, setGroupId] = useState(
        suggestedGroupId ?? groups[0]?.activityCode ?? ""
    );
    const [isPlacing, setIsPlacing] = useState(false);
    const [placed, setPlaced] = useState(false);
    const [error, setError] = useState("");

    const place = async () => {
        setIsPlacing(true);
        setError("");
        const { ok, message } = await placeInGroup(roundId, personId, groupId);
        setIsPlacing(false);
        if (!ok) {
            setError(message);
            return;
        }
        setPlaced(true);
        toast({
            title: `${name} is in ${activityCodeToName(groupId)}`,
            variant: "success",
        });
    };

    if (placed) {
        return (
            <p className="text-sm">
                {name} is in {activityCodeToName(groupId)}.
            </p>
        );
    }

    return (
        <div className="space-y-2 rounded-xl border p-3">
            <p className="text-sm">
                {name} has no group in {activityCodeToName(roundId)}. They can
                compete anyway, but won't be in the group lists or attendance.
            </p>
            <div className="flex flex-wrap items-center gap-2">
                <Select value={groupId} onValueChange={setGroupId}>
                    <SelectTrigger
                        className="w-fit"
                        aria-label={`Group for ${name}`}
                    >
                        <SelectValue placeholder="Choose a group" />
                    </SelectTrigger>
                    <SelectContent>
                        {groups.map((group) => (
                            <SelectItem
                                key={group.activityCode}
                                value={group.activityCode}
                            >
                                {activityCodeToName(group.activityCode)}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Button
                    size="sm"
                    onClick={place}
                    disabled={!groupId || isPlacing}
                >
                    Put {name} in this group
                </Button>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
    );
};

export default GroupPlacement;
