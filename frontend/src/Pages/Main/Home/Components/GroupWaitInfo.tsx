import { Button } from "@/Components/ui/button";
import { GroupWait } from "@/lib/rooms";

interface GroupWaitInfoProps {
    wait: GroupWait;
    timezone?: string;
    /** Undefined hides the "Not coming" buttons */
    onMarkNotComing?: (person: { id: string; name: string }) => void;
}

const plural = (count: number, one: string, many: string) =>
    `${count} ${count === 1 ? one : many}`;

/**
 * What keeps a running group from moving on: who hasn't started, and what
 * those who have still need to do
 */
const GroupWaitInfo = ({
    wait,
    timezone,
    onMarkNotComing,
}: GroupWaitInfoProps) => {
    // Nobody started yet, or nothing left: the card already says so
    if (wait.state === "notStarted" || wait.state === "finished") return null;

    const leftToDo = [
        wait.solving > 0 &&
            plural(wait.solving, "competitor solving", "competitors solving"),
        wait.incidents > 0 &&
            plural(
                wait.incidents,
                "incident to resolve",
                "incidents to resolve"
            ),
        wait.extras > 0 && plural(wait.extras, "extra to do", "extras to do"),
    ].filter(Boolean);
    const movesOnAt =
        wait.movesOnAt &&
        new Intl.DateTimeFormat("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: timezone,
        }).format(new Date(wait.movesOnAt));

    return (
        <div
            aria-label="What the group is waiting for"
            className="-mt-1 flex flex-col gap-2 text-sm"
        >
            {leftToDo.length > 0 && (
                <p className="text-muted-foreground">
                    Waiting for {leftToDo.join(" · ")}
                </p>
            )}
            {wait.notStarted.length > 0 && (
                <div className="flex flex-col gap-1">
                    <p className="text-muted-foreground">
                        {wait.notStarted.length === 1
                            ? "Not started yet:"
                            : `${wait.notStarted.length} not started yet:`}
                    </p>
                    <ul className="flex flex-col">
                        {wait.notStarted.map(({ personId, name }) => (
                            <li
                                key={personId ?? name}
                                className="flex min-h-9 items-center gap-2"
                            >
                                <span className="min-w-0 flex-1 truncate font-medium">
                                    {name}
                                </span>
                                {onMarkNotComing && personId && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        aria-label={`${name} is not coming`}
                                        onClick={() =>
                                            onMarkNotComing({
                                                id: personId,
                                                name,
                                            })
                                        }
                                    >
                                        Not coming
                                    </Button>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            {movesOnAt && (
                <p className="text-xs text-muted-foreground">
                    Moves on by itself at {movesOnAt} if nobody else solves
                </p>
            )}
        </div>
    );
};

export default GroupWaitInfo;
