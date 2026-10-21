import { EllipsisVertical, List, Shuffle } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/Components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/Components/ui/dropdown-menu";
import { ScrambleSet } from "@/lib/interfaces";
import { scrambleCountLabel } from "@/lib/scrambleSets";

interface ScrambleSetsListProps {
    /** null while loading */
    scrambleSets: ScrambleSet[] | null;
    /** The round is in progress in this room */
    canScramble: boolean;
}

const ScrambleSetsList = ({
    scrambleSets,
    canScramble,
}: ScrambleSetsListProps) => {
    const navigate = useNavigate();

    if (!scrambleSets) return null;

    if (!scrambleSets.length) {
        return (
            <p className="px-5 py-10 text-center text-muted-foreground">
                No scramble sets for this round
            </p>
        );
    }

    const openAllScrambles = (set: ScrambleSet) =>
        navigate(`/scrambling-device/set/${set.id}/scrambles`);

    return (
        <ul className="divide-y">
            {scrambleSets.map((set) => (
                <li
                    key={set.id}
                    className="flex min-h-16 items-center gap-3 py-2.5 pl-4 pr-3 md:pl-5"
                >
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="text-[15px] font-semibold">
                            Set {set.set}
                        </span>
                        <span className="text-[13px] text-muted-foreground">
                            {scrambleCountLabel(set)}
                        </span>
                    </div>
                    {canScramble ? (
                        <>
                            <Button
                                className="h-11 md:h-11"
                                onClick={() =>
                                    navigate(`/scrambling-device/set/${set.id}`)
                                }
                            >
                                <Shuffle />
                                Scramble
                            </Button>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="md:size-11 [&_svg]:size-[22px]"
                                        aria-label={`More actions for Set ${set.set}`}
                                    >
                                        <EllipsisVertical />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                    align="end"
                                    className="min-w-[200px]"
                                >
                                    <DropdownMenuItem
                                        onClick={() => openAllScrambles(set)}
                                    >
                                        <List />
                                        All scrambles
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </>
                    ) : (
                        <Button
                            variant="outline"
                            className="h-11 border-border md:h-11"
                            onClick={() => openAllScrambles(set)}
                        >
                            <List />
                            All scrambles
                        </Button>
                    )}
                </li>
            ))}
        </ul>
    );
};

export default ScrambleSetsList;
