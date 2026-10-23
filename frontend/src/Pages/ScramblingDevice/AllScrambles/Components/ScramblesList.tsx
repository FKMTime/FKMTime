import { DecryptedScramble } from "@/lib/interfaces";
import { cn } from "@/lib/utils";

interface ScramblesListProps {
    scrambles: DecryptedScramble[];
    eventId: string;
}

/** Regular scrambles first, then extras (E1, E2) */
const sortScrambles = (scrambles: DecryptedScramble[]) =>
    [...scrambles].sort(
        (a, b) => Number(a.isExtra) - Number(b.isExtra) || a.num - b.num
    );

const ScramblesList = ({ scrambles, eventId }: ScramblesListProps) => (
    <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
        {sortScrambles(scrambles).map((scramble) => (
            <li
                key={scramble.id}
                className="flex flex-wrap items-center gap-4 px-5 py-4"
            >
                <span
                    aria-label={
                        scramble.isExtra
                            ? `Extra ${scramble.num}`
                            : `Scramble ${scramble.num}`
                    }
                    className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold",
                        scramble.isExtra
                            ? "bg-warning-soft text-warning"
                            : "bg-secondary text-foreground"
                    )}
                >
                    {scramble.isExtra ? "E" : ""}
                    {scramble.num}
                </span>
                <p className="min-w-0 flex-[1_1_280px] font-mono text-lg font-semibold leading-[1.6] [word-spacing:4px]">
                    {scramble.scramble}
                </p>
                <scramble-display
                    scramble={scramble.scramble}
                    event={eventId}
                    style={{ width: 160, height: 120 }}
                ></scramble-display>
            </li>
        ))}
    </ul>
);

export default ScramblesList;
