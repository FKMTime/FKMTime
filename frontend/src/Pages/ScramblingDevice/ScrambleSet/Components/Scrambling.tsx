import { RefObject, useRef, useState } from "react";

import { Button } from "@/Components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { Input } from "@/Components/ui/input";
import { useToast } from "@/hooks/useToast";
import { DecryptedScramble, Person, ScrambleData } from "@/lib/interfaces";
import { getPersonByCardId, getScrambleData } from "@/lib/scrambling";

import Scramble from "./Scramble";

interface ScramblingProps {
    groupId: string;
    scrambles: DecryptedScramble[];
}

const Scrambling = ({ groupId, scrambles }: ScramblingProps) => {
    const { toast } = useToast();
    const [competitorCard, setCompetitorCard] = useState<string>("");
    const [scramblerCard, setScramblerCard] = useState<string>("");
    const [person, setPerson] = useState<Person | null>(null);
    const [scrambler, setScrambler] = useState<Person | null>(null);
    const [scrambleData, setScrambleData] = useState<ScrambleData | null>(null);
    const competitorCardInputRef: RefObject<HTMLInputElement> =
        useRef<HTMLInputElement>(null);

    const roundId = groupId.split("-g")[0];

    const fetchScrambleData = async () => {
        if (!scrambler) return;
        if (competitorCard === scrambler.cardId) {
            return toast({
                title: "Scrambler and competitor cannot be the same",
                variant: "destructive",
            });
        }
        const { data, status } = await getScrambleData(
            competitorCard,
            groupId.split("-g")[0]
        );
        if (!data || status === 404) {
            return toast({
                title: "Competitor not found",
                variant: "destructive",
            });
        }
        if (data.scrambleData.num === -1) {
            setCompetitorCard("");
            return toast({
                title: "No attempts left",
                variant: "destructive",
            });
        }
        setScrambleData(data.scrambleData);
        setPerson(data.person);
    };

    const fetchScramblerData = async () => {
        const data = await getPersonByCardId(scramblerCard);
        if (!data.id) {
            toast({
                title: "Scrambler not found",
                variant: "destructive",
            });
            return setScramblerCard("");
        }
        setScrambler(data);
        setScramblerCard("");
        competitorCardInputRef.current?.focus();
    };

    const clearScrambleData = () => {
        setPerson(null);
        setScrambleData(null);
        setCompetitorCard("");
    };

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        {scrambler ? (
                            <>
                                Current scrambler: {scrambler.name} (
                                {scrambler.wcaId})
                                <Button onClick={() => setScrambler(null)}>
                                    Change scrambler
                                </Button>
                            </>
                        ) : (
                            "Scan the scrambler's card to start"
                        )}
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center gap-4">
                    {!scrambler && (
                        <Input
                            placeholder="Scan the scrambler's card"
                            width="fit-content"
                            autoFocus
                            disabled={scrambler !== null}
                            value={scramblerCard}
                            onChange={(e) => setScramblerCard(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    fetchScramblerData();
                                }
                            }}
                        />
                    )}
                    <Input
                        placeholder="Scan the competitor's card"
                        width="fit-content"
                        ref={competitorCardInputRef}
                        value={competitorCard}
                        onChange={(e) => setCompetitorCard(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                fetchScrambleData();
                            }
                        }}
                    />
                </CardContent>
            </Card>
            {person && scrambleData && scrambler && (
                <Scramble
                    person={person}
                    scrambles={scrambles}
                    scrambler={scrambler}
                    scrambleData={scrambleData}
                    roundId={roundId}
                    onSign={clearScrambleData}
                />
            )}
        </>
    );
};

export default Scrambling;
