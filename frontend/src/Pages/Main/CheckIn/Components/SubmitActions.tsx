import { Button, Checkbox, FormControl } from "@chakra-ui/react";
import { useState } from "react";

import { Person } from "@/logic/interfaces.ts";
import { isNewcomer, regionNameByIso2 } from "@/logic/utils.ts";

interface SubmitActionsProps {
    handleCheckIn: () => void;
    person: Person;
    cardShouldBeAssigned: boolean;
}

const SubmitActions = ({
    handleCheckIn,
    person,
    cardShouldBeAssigned,
}: SubmitActionsProps) => {
    const newcomer = isNewcomer(person);
    const [documentChecked, setDocumentChecked] = useState<boolean>(false);
    const [confirmedIsNewcomer, setConfirmedIsNewcomer] =
        useState<boolean>(false);
    const [citizienshipChecked, setCitizienshipChecked] =
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
                    <FormControl display="flex" flexDirection="column" gap="2">
                        <Checkbox
                            defaultChecked={false}
                            onChange={(event) =>
                                setCitizienshipChecked(event?.target.checked)
                            }
                        >
                            I have checked that the competitor is a citizien of{" "}
                            {regionNameByIso2(person.countryIso2 || "")}
                        </Checkbox>
                    </FormControl>
                </>
            )}
            <Button
                colorScheme="green"
                onClick={() => handleCheckIn()}
                isDisabled={
                    (newcomer &&
                        (!documentChecked ||
                            !confirmedIsNewcomer ||
                            !citizienshipChecked)) ||
                    !person.cardId
                }
            >
                Check in {cardShouldBeAssigned && "and assign card"}
            </Button>
        </>
    );
};

export default SubmitActions;
