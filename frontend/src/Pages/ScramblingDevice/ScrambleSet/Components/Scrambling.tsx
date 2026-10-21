import { CircleCheck, IdCard, Nfc } from "lucide-react";
import { useState } from "react";

import { Button } from "@/Components/ui/button";
import { useToast } from "@/hooks/useToast";
import { DecryptedScramble, Person, ScrambleData } from "@/lib/interfaces";
import { playScanSound } from "@/lib/scanSound";
import {
    createScrambledAttempt,
    getPersonByCardId,
    getScrambleData,
} from "@/lib/scrambling";

import { roundName } from "../../scramblingDeviceContext";
import ScanPrompt from "./ScanPrompt";
import ScrambleCard from "./ScrambleCard";

interface ScramblingProps {
    roundId: string;
    /** The round's group running in this room, if any */
    groupId?: string;
    scrambles: DecryptedScramble[];
}

interface Competitor {
    person: Person;
    scrambleData: ScrambleData;
}

/** Scan the scrambler, then each competitor, show their scramble and sign it */
const Scrambling = ({ roundId, groupId, scrambles }: ScramblingProps) => {
    const { toast } = useToast();
    const [scrambler, setScrambler] = useState<Person | null>(null);
    const [competitor, setCompetitor] = useState<Competitor | null>(null);
    const [scanError, setScanError] = useState("");
    const [isSigning, setIsSigning] = useState(false);

    const groupNumber = groupId?.split("-g")[1];
    // Stays visible after signing, so the scrambler can check what was signed
    const [lastSigned, setLastSigned] = useState("");

    const scanScrambler = async (cardId: string) => {
        const data = await getPersonByCardId(cardId);
        if (!data.id) {
            playScanSound("error");
            setScanError("Scrambler not found");
            return;
        }
        playScanSound("success");
        setScrambler(data);
    };

    const scanCompetitor = async (cardId: string) => {
        if (!scrambler) return;
        if (cardId === scrambler.cardId) {
            playScanSound("error");
            setScanError("Scrambler and competitor cannot be the same");
            return;
        }
        const { data, status } = await getScrambleData(cardId, roundId);
        if (!data || status === 404) {
            playScanSound("error");
            setScanError("Competitor not found");
            return;
        }
        if (data.scrambleData.num === -1) {
            playScanSound("error");
            setScanError("No attempts left");
            return;
        }
        playScanSound("success");
        setCompetitor({ person: data.person, scrambleData: data.scrambleData });
    };

    const changeScrambler = () => {
        setLastSigned("");
        setScrambler(null);
        setCompetitor(null);
        setScanError("");
    };

    const sign = async () => {
        if (!scrambler || !competitor) return;
        setIsSigning(true);
        const response = await createScrambledAttempt(
            competitor.person.id,
            scrambler.id,
            roundId,
            competitor.scrambleData.num,
            competitor.scrambleData.isExtra
        );
        setIsSigning(false);
        if (response.status === 201) {
            const { num, isExtra } = competitor.scrambleData;
            setLastSigned(
                `${competitor.person.name} · ${isExtra ? "Extra" : "Scramble"} ${num}`
            );
            setCompetitor(null);
        } else {
            toast({
                title: "Something went wrong",
                variant: "destructive",
            });
        }
    };

    if (!scrambler) {
        return (
            <ScanPrompt
                icon={IdCard}
                title="Scan the scrambler's card"
                description="The scrambler signs every attempt scrambled on this device."
                error={scanError}
                onScan={scanScrambler}
                onChange={() => setScanError("")}
            />
        );
    }

    return (
        <>
            <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card py-2.5 pl-4 pr-3">
                <IdCard className="size-5 text-muted-foreground" />
                <span className="min-w-[180px] flex-1 text-muted-foreground">
                    Scrambler{" "}
                    <b className="font-semibold text-foreground">
                        {scrambler.name}
                    </b>{" "}
                    · {scrambler.wcaId || "Newcomer"}
                </span>
                <Button
                    variant="outline"
                    className="border-border px-3"
                    onClick={changeScrambler}
                >
                    Change scrambler
                </Button>
            </div>
            {competitor ? (
                <ScrambleCard
                    person={competitor.person}
                    scrambleData={competitor.scrambleData}
                    scramble={scrambles.find(
                        (scramble) =>
                            scramble.num === competitor.scrambleData.num &&
                            scramble.isExtra === competitor.scrambleData.isExtra
                    )}
                    eventId={roundId.split("-")[0]}
                    isSigning={isSigning}
                    onCancel={() => setCompetitor(null)}
                    onSign={sign}
                />
            ) : (
                <>
                    {lastSigned && (
                        <p
                            role="status"
                            className="flex items-center gap-2 rounded-xl bg-success-soft px-4 py-2.5 text-sm font-semibold text-success"
                        >
                            <CircleCheck className="size-[18px] shrink-0" />
                            Last signed: {lastSigned}
                        </p>
                    )}
                    <ScanPrompt
                        icon={Nfc}
                        title="Scan the competitor's card"
                        description={
                            groupNumber
                                ? `${roundName(roundId)} · Group ${groupNumber}`
                                : roundName(roundId)
                        }
                        error={scanError}
                        onScan={scanCompetitor}
                        onChange={() => setScanError("")}
                    />
                </>
            )}
        </>
    );
};

export default Scrambling;
