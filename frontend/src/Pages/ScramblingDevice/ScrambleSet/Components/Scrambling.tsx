import {
    Alert,
    AlertIcon,
    Box,
    Button,
    Heading,
    Input,
    useToast,
} from "@chakra-ui/react";
import { RefObject, useRef, useState } from "react";

import { DecryptedScramble, Person, ScrambleData } from "@/lib/interfaces";
import { getPersonByCardId, getScrambleData } from "@/lib/scrambling";

import Scramble from "./Scramble";

interface ScramblingProps {
    groupId: string;
    scrambles: DecryptedScramble[];
}

const Scrambling = ({ groupId, scrambles }: ScramblingProps) => {
    const toast = useToast();
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
        const { data, status } = await getScrambleData(competitorCard);
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
        <Box display="flex" flexDirection="column" gap={3}>
            {scrambler ? (
                <Box display="flex" gap={3} alignItems="center">
                    <Heading size="lg">
                        Current scrambler: {scrambler.name} ({scrambler.wcaId})
                    </Heading>
                    <Button
                        onClick={() => setScrambler(null)}
                        colorScheme="yellow"
                    >
                        Change scrambler
                    </Button>
                </Box>
            ) : (
                <Alert status="warning" color="black">
                    <AlertIcon /> Scan the scrambler's card to start
                </Alert>
            )}
            <Box display="flex" justifyContent="space-between">
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
            </Box>
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
        </Box>
    );
};

export default Scrambling;
