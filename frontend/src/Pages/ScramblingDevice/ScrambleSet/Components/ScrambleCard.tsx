import { Signature } from "lucide-react";

import { Button } from "@/Components/ui/button";
import { DecryptedScramble, Person, ScrambleData } from "@/lib/interfaces";

interface ScrambleCardProps {
    person: Person;
    scrambleData: ScrambleData;
    scramble?: DecryptedScramble;
    eventId: string;
    isSigning: boolean;
    onCancel: () => void;
    onSign: () => void;
}

const ScrambleCard = ({
    person,
    scrambleData,
    scramble,
    eventId,
    isSigning,
    onCancel,
    onSign,
}: ScrambleCardProps) => (
    <section className="overflow-hidden rounded-2xl border bg-card">
        <div className="flex flex-wrap items-center gap-3 border-b px-5 py-4">
            <div className="flex min-w-[180px] flex-1 flex-col gap-0.5">
                <h2 className="text-lg font-bold">{person.name}</h2>
                <span className="text-[13px] text-muted-foreground">
                    {person.wcaId || "Newcomer"}
                </span>
            </div>
            <span className="flex h-8 items-center rounded-full bg-primary-soft px-3 text-sm font-bold text-primary">
                {scrambleData.isExtra ? "Extra" : "Scramble"} {scrambleData.num}
            </span>
        </div>
        <div className="flex flex-wrap items-center gap-6 px-5 py-6">
            <p className="min-w-0 flex-[1_1_320px] text-pretty font-mono text-[26px] font-semibold leading-[1.6] [word-spacing:6px]">
                {scramble?.scramble || "Scramble not found"}
            </p>
            {scramble && (
                <div className="flex max-w-full flex-none justify-center">
                    <scramble-display
                        scramble={scramble.scramble}
                        event={eventId}
                    ></scramble-display>
                </div>
            )}
        </div>
        <div className="flex justify-end gap-2 border-t bg-secondary px-5 py-3.5">
            <Button
                variant="ghost"
                className="h-12 text-[15px] md:h-12"
                onClick={onCancel}
            >
                Cancel
            </Button>
            <Button
                className="h-12 gap-2 px-6 text-[15px] md:h-12 [&_svg]:size-5"
                disabled={isSigning}
                onClick={onSign}
            >
                <Signature />
                Sign
            </Button>
        </div>
    </section>
);

export default ScrambleCard;
