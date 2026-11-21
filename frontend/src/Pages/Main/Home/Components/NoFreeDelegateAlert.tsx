import { ShieldAlert } from "lucide-react";
import { useState } from "react";

import GiveDelegateAccessModal from "@/Components/GiveDelegateAccessModal";
import { Alert, AlertDescription, AlertTitle } from "@/Components/ui/alert";
import { Button } from "@/Components/ui/button";
import { describeUncoveredGroup, UncoveredGroup } from "@/lib/delegateGrants";

interface NoFreeDelegateAlertProps {
    groups: UncoveredGroup[];
    /** Whether the rooms are named elsewhere, so each group says where */
    showRooms: boolean;
}

/**
 * Running and next groups every delegate competes in (SPEC-015): give
 * someone delegate access so their incidents don't wait. Gone once someone
 * has access for the group.
 */
const NoFreeDelegateAlert = ({
    groups,
    showRooms,
}: NoFreeDelegateAlertProps) => {
    const [givingFor, setGivingFor] = useState<string | null>(null);
    if (groups.length === 0) return null;

    return (
        <Alert variant="warning">
            <ShieldAlert />
            <AlertTitle>
                {groups.length === 1
                    ? describeUncoveredGroup(groups[0]).title
                    : `No delegate free for ${groups.length} groups`}
            </AlertTitle>
            <AlertDescription>
                <ul className="mt-1 flex flex-col gap-3">
                    {groups.map((group) => (
                        <li
                            key={group.groupId}
                            className="flex flex-wrap items-center justify-between gap-3"
                        >
                            <div className="flex min-w-0 flex-col gap-0.5">
                                {groups.length > 1 && (
                                    <span className="font-semibold">
                                        {group.groupName}
                                    </span>
                                )}
                                <span>
                                    {showRooms &&
                                        `${group.running ? "Running" : "Next"} in ${group.roomNames.join(", ")}. `}
                                    {describeUncoveredGroup(group).body}
                                </span>
                            </div>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setGivingFor(group.groupId)}
                            >
                                Give delegate access…
                            </Button>
                        </li>
                    ))}
                </ul>
            </AlertDescription>
            {givingFor && (
                <GiveDelegateAccessModal
                    isOpen
                    onClose={() => setGivingFor(null)}
                    groupIds={[givingFor]}
                />
            )}
        </Alert>
    );
};

export default NoFreeDelegateAlert;
