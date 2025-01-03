import { Button } from "@chakra-ui/react";
import { useState } from "react";

import { Checkbox } from "@/Components/ui/checkbox";
import { Field } from "@/Components/ui/field";
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
                    <Field display="flex" flexDirection="column" gap="2">
                        <Checkbox
                            defaultChecked={false}
                            onCheckedChange={(e) =>
                                setDocumentChecked(!!e.checked)
                            }
                        >
                            I have checked the competitor's ID card and data
                            matches with those provided during registration
                        </Checkbox>
                    </Field>
                    <Field display="flex" flexDirection="column" gap="2">
                        <Checkbox
                            defaultChecked={false}
                            onCheckedChange={(e) =>
                                setConfirmedIsNewcomer(!!e.checked)
                            }
                        >
                            I have verbally confirmed that the competitor is a
                            newcomer
                        </Checkbox>
                    </Field>
                    <Field display="flex" flexDirection="column" gap="2">
                        <Checkbox
                            defaultChecked={false}
                            onCheckedChange={(e) =>
                                setCitizienshipChecked(!!e.checked)
                            }
                        >
                            I have checked that the competitor is a citizien of{" "}
                            {regionNameByIso2(person.countryIso2 || "")}
                        </Checkbox>
                    </Field>
                </>
            )}
            <Button
                colorPalette="green"
                onClick={() => handleCheckIn()}
                disabled={
                    (newcomer &&
                        (!documentChecked ||
                            !confirmedIsNewcomer ||
                            !citizienshipChecked)) ||
                    !person.cardId
                }
            >
                Check in {cardShouldBeAssigned ? "and assign card" : ""}
            </Button>
        </>
    );
};

export default SubmitActions;
