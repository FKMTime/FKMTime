import { Button, Checkbox, FormControl } from "@chakra-ui/react";
import { useState } from "react";

import { Person } from "@/logic/interfaces.ts";
import { isNewcomer } from "@/logic/utils.ts";

interface SubmitActionsProps {
    handleCheckIn: () => void;
    person: Person;
}

const SubmitActions = ({ handleCheckIn, person }: SubmitActionsProps) => {
    const newcomer = isNewcomer(person);
    const [documentChecked, setDocumentChecked] = useState<boolean>(false);
    const [confirmedIsNewcomer, setConfirmedIsNewcomer] =
        useState<boolean>(false);

    return (
        <>
            {newcomer && (
                <>
                    <FormControl display="flex" flexDirection="column" gap="2">
                        <Checkbox
                            defaultChecked={false}
                            onChange={(event) =>
                                setDocumentChecked(event?.target.checked)
                            }
                        >
                            I have checked the competitor's ID card and data
                            matches with those provided during registration
                        </Checkbox>
                    </FormControl>
                    <FormControl display="flex" flexDirection="column" gap="2">
                        <Checkbox
                            defaultChecked={false}
                            onChange={(event) =>
                                setConfirmedIsNewcomer(event?.target.checked)
                            }
                        >
                            I have verbally confirmed that the competitor is a
                            newcomer
                        </Checkbox>
                    </FormControl>
                </>
            )}
            <Button
                colorScheme="green"
                onClick={() => handleCheckIn()}
                isDisabled={
                    newcomer && (!documentChecked || !confirmedIsNewcomer)
                }
            >
                Check in
            </Button>
        </>
    );
};

export default SubmitActions;
