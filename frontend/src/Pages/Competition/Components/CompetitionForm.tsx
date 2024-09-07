import {
    Box,
    Button,
    Checkbox,
    FormControl,
    FormHelperText,
    FormLabel,
    Link,
    Select,
} from "@chakra-ui/react";
import { FormEvent } from "react";

import PasswordInput from "@/Components/PasswordInput.tsx";
import { Competition, SendingResultsFrequency } from "@/logic/interfaces.ts";
import { prettySendingResultsFrequency } from "@/logic/utils";

interface CompetitionFormProps {
    competition: Competition;
    setCompetition: (competition: Competition) => void;
    handleSubmit: (event: FormEvent<HTMLFormElement>) => void;
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
            as="form"
            onSubmit={handleSubmit}
        >
            <FormControl display="flex" flexDirection="column" gap="2">
                <FormLabel>Scoretaking token</FormLabel>
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
                <FormHelperText color="gray.300">
                    You can get this token{" "}
                    <Link
                        color="blue.400"
                        href="https://live.worldcubeassociation.org/account"
                        isExternal
                    >
                        here
                    </Link>
                </FormHelperText>
            </FormControl>
            <FormControl display="flex" flexDirection="column" gap="2">
                <FormLabel>Cubing contests token</FormLabel>
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
                <FormHelperText color="gray.300">
                    You can get this token{" "}
                    <Link
                        color="blue.400"
                        href={`https://cubingcontests.com/mod/competition?edit_id=${competition.wcaId}`}
                        isExternal
                    >
                        here
                    </Link>
                </FormHelperText>
            </FormControl>
            <FormControl display="flex" flexDirection="column" gap="2">
                <FormLabel>Send results to WCA Live/Cubing contests</FormLabel>
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
            </FormControl>
            <FormControl display="flex" flexDirection="column" gap="2">
                <Checkbox
                    defaultChecked={competition.shouldChangeGroupsAutomatically}
                    onChange={(event) =>
                        setCompetition({
                            ...competition,
                            shouldChangeGroupsAutomatically:
                                event?.target.checked,
                        })
                    }
                >
                    Change groups automatically
                </Checkbox>
                <FormHelperText color="gray.300">
                    Group will be automatically changed to the next one from
                    schedule if all results are entered and there are no
                    unresolved incidents
                </FormHelperText>
            </FormControl>
            <Button type="submit" colorScheme="green">
                Save
            </Button>
        </Box>
    );
};

export default CompetitionForm;
