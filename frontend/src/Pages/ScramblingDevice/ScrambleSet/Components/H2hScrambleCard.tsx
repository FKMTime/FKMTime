import { ArrowRight, TriangleAlert } from "lucide-react";

import { Button } from "@/Components/ui/button";
import { DecryptedScramble, H2hMatchScramble } from "@/lib/interfaces";

interface H2hScrambleCardProps {
    /** The match, or null when it isn't playing any more */
    match: H2hMatchScramble | null;
    /** The unlocked scramble set this page shows */
    scrambleSetId: string;
    scrambles: DecryptedScramble[];
    eventId: string;
    /** Opens another set of the round for the same match */
    onOpenSet: (scrambleSetId: string) => void;
    onBack: () => void;
}

const Warning = ({ children }: { children: string }) => (
    <p
        role="alert"
        className="flex items-start gap-2.5 rounded-xl bg-warning-soft px-4 py-3 text-sm font-semibold text-warning"
    >
        <TriangleAlert className="mt-px size-[18px] shrink-0" />
        {children}
    </p>
);

/**
 * The scramble a head-to-head match's next point races, for both cubes
 * (I4b1). It moves on by itself once both competitors' results are in.
 */
const H2hScrambleCard = ({
    match,
    scrambleSetId,
    scrambles,
    eventId,
    onOpenSet,
    onBack,
}: H2hScrambleCardProps) => {
    if (!match) {
        return (
            <section className="flex flex-col items-start gap-3 rounded-2xl border bg-card px-5 py-6">
                <p className="text-[15px]">This match isn&apos;t playing.</p>
                <Button variant="outline" onClick={onBack}>
                    Back to the matches
                </Button>
            </section>
        );
    }
    const { scramble } = match;
    if (!scramble) {
        return <Warning>{match.warning ?? match.text}</Warning>;
    }
    if (scramble.scrambleSetId !== scrambleSetId) {
        return (
            <section className="flex flex-col items-start gap-3 rounded-2xl border bg-card px-5 py-6">
                <p className="text-[15px]">
                    {match.label}, set {match.setNumber} now races Set{" "}
                    {scramble.set}.
                </p>
                <Button onClick={() => onOpenSet(scramble.scrambleSetId)}>
                    Open Set {scramble.set}
                    <ArrowRight />
                </Button>
            </section>
        );
    }
    const shown = scrambles.find(
        (s) => s.num === scramble.num && s.isExtra === scramble.isExtra
    );
    return (
        <>
            {match.warning && <Warning>{match.warning}</Warning>}
            <section className="overflow-hidden rounded-2xl border bg-card">
                <div className="flex flex-wrap items-center gap-3 border-b px-5 py-4">
                    <div className="flex min-w-[180px] flex-1 flex-col gap-0.5">
                        <h2 className="text-lg font-bold">{match.label}</h2>
                        <span className="text-[13px] text-muted-foreground">
                            Set {match.setNumber} · point {match.pointNumber}
                        </span>
                    </div>
                    <span className="flex h-8 items-center rounded-full bg-primary-soft px-3 text-sm font-bold text-primary">
                        {scramble.isExtra ? "Extra" : "Scramble"} {scramble.num}
                    </span>
                </div>
                <div className="flex flex-wrap items-center gap-6 px-5 py-6">
                    <p className="min-w-0 flex-[1_1_320px] text-pretty font-mono text-[26px] font-semibold leading-[1.6] [word-spacing:6px]">
                        {shown?.scramble || "Scramble not found"}
                    </p>
                    {shown && (
                        <div className="flex max-w-full flex-none justify-center">
                            <scramble-display
                                scramble={shown.scramble}
                                event={eventId}
                            ></scramble-display>
                        </div>
                    )}
                </div>
                <p className="border-t bg-secondary px-5 py-3.5 text-sm text-muted-foreground">
                    Scramble both competitors&apos; cubes with this scramble.
                    The next point&apos;s shows once both results are in.
                </p>
            </section>
        </>
    );
};

export default H2hScrambleCard;
