import { Box, Link } from "@chakra-ui/react";

import PasswordInput from "@/Components/PasswordInput.tsx";
import Select from "@/Components/Select";
import { Button } from "@/Components/ui/button";
import { Checkbox } from "@/Components/ui/checkbox";
import { Field } from "@/Components/ui/field";
import { Competition, SendingResultsFrequency } from "@/logic/interfaces.ts";
import { prettySendingResultsFrequency } from "@/logic/utils";

interface CompetitionFormProps {
    competition: Competition;
    setCompetition: (competition: Competition) => void;
    handleSubmit: () => void;
}

const CompetitionForm = ({
    competition,
    setCompetition,
    handleSubmit,
}: CompetitionFormProps) => {
    return (
        <Box
            display="flex"
            flexDirection="column"
            gap="5"
            width={{ base: "100%", md: "20%" }}
        >
            <Field
                display="flex"
                flexDirection="column"
                gap="2"
                label="Scoretaking token"
                helperText={
                    <>
                        You can get this token{" "}
                        <Link
                            color="blue.400"
                            href="https://live.worldcubeassociation.org/account"
                        >
                            here
                        </Link>
                    </>
                }
            >
                <PasswordInput
                    placeholder="Scoretaking token"
                    autoComplete="off"
                    value={competition?.scoretakingToken}
                    onChange={(event) =>
                        setCompetition({
                            ...competition,
                            scoretakingToken: event?.target.value,
                        })
                    }
                />
            </Field>
            <Field
                display="flex"
                flexDirection="column"
                gap="2"
                label="Cubing contests token"
                helperText={
                    <>
                        You can get this token{" "}
                        <Link
                            color="blue.400"
                            href={`https://cubingcontests.com/mod/competition?edit_id=${competition.wcaId}`}
                        >
                            here
                        </Link>
                    </>
                }
            >
                <PasswordInput
                    placeholder="Cubing contests API token"
                    autoComplete="off"
                    value={competition?.cubingContestsToken}
                    onChange={(event) =>
                        setCompetition({
                            ...competition,
                            cubingContestsToken: event?.target.value,
                        })
                    }
                />
            </Field>
            <Field
                display="flex"
                flexDirection="column"
                gap="2"
                label="Send results to WCA Live/CubingContests"
            >
                <Select
                    value={competition.sendingResultsFrequency}
                    onChange={(event) =>
                        setCompetition({
                            ...competition,
                            sendingResultsFrequency: event?.target
                                .value as SendingResultsFrequency,
                        })
                    }
                >
                    {Object.values(SendingResultsFrequency).map((frequency) => (
                        <option key={frequency} value={frequency}>
                            {prettySendingResultsFrequency(frequency)}
                        </option>
                    ))}
                </Select>
            </Field>
            <Field
                display="flex"
                flexDirection="column"
                gap="2"
                label="Change groups automatically"
                helperText="Group will be automatically changed to the next one from schedule if all results are entered and there are no unresolved incidents"
            >
                <Checkbox
                    defaultChecked={competition.shouldChangeGroupsAutomatically}
                    onCheckedChange={(event) =>
                        setCompetition({
                            ...competition,
                            shouldChangeGroupsAutomatically: !!event?.checked,
                        })
                    }
                >
                    Change groups automatically
                </Checkbox>
            </Field>
            <Button onClick={handleSubmit} colorPalette="green">
                Save
            </Button>
        </Box>
    );
};

export default CompetitionForm;
