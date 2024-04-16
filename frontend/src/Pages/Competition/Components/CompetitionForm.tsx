import {
    Box,
    Button,
    Checkbox,
    FormControl,
    FormLabel,
} from "@chakra-ui/react";
import { FormEvent } from "react";

import PasswordInput from "@/Components/PasswordInput.tsx";
import { Competition } from "@/logic/interfaces.ts";

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
            </FormControl>
            <FormControl display="flex" flexDirection="column" gap="2">
                <Checkbox
                    defaultChecked={competition.sendResultsToWcaLive}
                    onChange={(event) =>
                        setCompetition({
                            ...competition,
                            sendResultsToWcaLive: event?.target.checked,
                        })
                    }
                >
                    Send results to WCA Live (disable it only during tutorial)
                </Checkbox>
            </FormControl>
            <Button type="submit" colorScheme="green">
                Save
            </Button>
        </Box>
    );
};

export default CompetitionForm;
