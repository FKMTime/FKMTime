import { Button } from "@/Components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/Components/ui/card";
import { useToast } from "@/hooks/useToast";
import { DecryptedScramble, Person, ScrambleData } from "@/lib/interfaces";
import { createScrambledAttempt } from "@/lib/scrambling";

interface ScrambleProps {
    person: Person;
    scrambles: DecryptedScramble[];
    scrambleData: ScrambleData;
    scrambler: Person;
    roundId: string;
    onSign: () => void;
}

const Scramble = ({
    person,
    scrambles,
    scrambler,
    scrambleData,
    roundId,
    onSign,
}: ScrambleProps) => {
    const { toast } = useToast();
    const currentScramble = scrambles.find(
        (scramble) =>
            scramble.num === scrambleData.num &&
            scramble.isExtra === scrambleData.isExtra
    );

    const handleSign = async () => {
        const response = await createScrambledAttempt(
            person.id,
            scrambler.id,
            roundId,
            scrambleData.num,
            scrambleData.isExtra
        );
        if (response.status === 201) {
            toast({
                title: "Succesfully signed the attempt",
                variant: "success",
            });
            onSign();
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>
                    {person.name} ({person.wcaId})
                </CardTitle>
                <CardDescription>
                    Scramble {scrambleData.isExtra ? "Extra" : null}{" "}
                    {scrambleData.num}{" "}
                </CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
                <pre className="text-wrap max-w-[60%] text-2xl">
                    {currentScramble?.scramble || "Scramble not found"}
                </pre>
                <scramble-display
                    scramble={currentScramble?.scramble}
                    event={roundId.split("-")[0]}
                ></scramble-display>
            </CardContent>
            <CardFooter>
                <Button onClick={handleSign}>Sign</Button>
            </CardFooter>
        </Card>
    );
};

export default Scramble;
