import {
    Box,
    Button,
    Card,
    CardBody,
    CardFooter,
    Divider,
    Heading,
    useToast,
} from "@chakra-ui/react";

import { DecryptedScramble, Person, ScrambleData } from "@/logic/interfaces";
import { createScrambledAttempt } from "@/logic/scrambling";

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
    const toast = useToast();
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
                status: "success",
            });
            onSign();
        }
    };

    return (
        <Card backgroundColor="gray.400">
            <CardBody>
                <Box
                    display="flex"
                    gap={2}
                    alignItems="center"
                    justifyContent="space-between"
                >
                    <Box display="flex" gap={2} alignItems="center">
                        <Heading size="lg">
                            {person.name} ({person.wcaId})
                        </Heading>
                    </Box>
                    <Heading size="md">
                        Scramble {scrambleData.isExtra ? "Extra" : null}{" "}
                        {scrambleData.num}{" "}
                    </Heading>
                </Box>
                <Box
                    display="flex"
                    flexDirection={{ base: "column", md: "row" }}
                    mt={5}
                    alignItems="center"
                    gap={10}
                >
                    <Heading
                        size="lg"
                        as="pre"
                        whiteSpace="pre-wrap"
                        maxWidth="60%"
                    >
                        {currentScramble?.scramble || "Scramble not found"}
                    </Heading>
                    <scramble-display
                        scramble={currentScramble?.scramble}
                        event={roundId.split("-")[0]}
                    ></scramble-display>
                </Box>
            </CardBody>
            <Divider />
            <CardFooter>
                <Button variant="solid" colorScheme="blue" onClick={handleSign}>
                    Sign
                </Button>
            </CardFooter>
        </Card>
    );
};

export default Scramble;
