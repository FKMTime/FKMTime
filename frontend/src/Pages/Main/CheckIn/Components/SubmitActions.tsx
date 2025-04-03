import { SquareCheckBig } from "lucide-react";
import { useState } from "react";

import { Button } from "@/Components/ui/button";
import { Checkbox } from "@/Components/ui/checkbox";
import { Label } from "@/Components/ui/label";
import { Person } from "@/lib/interfaces";
import { isNewcomer, regionNameByIso2 } from "@/lib/utils.ts";

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
    const [nameChecked, setNameChecked] = useState<boolean>(false);
    const [dobChecked, setDobChecked] = useState<boolean>(false);
    const [confirmedIsNewcomer, setConfirmedIsNewcomer] =
        useState<boolean>(false);
    const [citizienshipChecked, setCitizienshipChecked] =
        useState<boolean>(false);

    return (
        <div className="flex flex-col gap-3">
            {newcomer && (
                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                        <Checkbox
                            checked={nameChecked}
                            onCheckedChange={(value) => setNameChecked(!!value)}
                        />
                        <Label>
                            I have checked the competitor's ID card and the name
                            of the competitor is {person.name}
                        </Label>
                    </div>
                    {person.birthdate && (
                        <div className="flex items-center gap-2">
                            <Checkbox
                                checked={dobChecked}
                                onCheckedChange={(value) =>
                                    setDobChecked(!!value)
                                }
                            />
                            <Label>
                                I have checked the competitor's ID card and the
                                date of birth is{" "}
                                {
                                    new Date(person.birthdate || "")
                                        .toISOString()
                                        .split("T")[0]
                                }
                            </Label>
                        </div>
                    )}
                    <div className="flex items-center gap-2">
                        <Checkbox
                            checked={confirmedIsNewcomer}
                            onCheckedChange={(value) =>
                                setConfirmedIsNewcomer(!!value)
                            }
                        />
                        <Label>
                            I have verbally confirmed that the competitor is a
                            newcomer
                        </Label>
                    </div>
                    <div className="flex items-center gap-2">
                        <Checkbox
                            checked={citizienshipChecked}
                            onCheckedChange={(value) =>
                                setCitizienshipChecked(!!value)
                            }
                        />
                        <Label>
                            I have checked that the competitor is a citizien of{" "}
                            {regionNameByIso2(person.countryIso2 || "")}
                        </Label>
                    </div>
                </div>
            )}
            <Button
                variant="success"
                className="w-fit"
                onClick={() => handleCheckIn()}
                disabled={
                    (newcomer &&
                        (!nameChecked ||
                            (!dobChecked && person.birthdate !== null) ||
                            !confirmedIsNewcomer ||
                            !citizienshipChecked)) ||
                    !person.cardId
                }
            >
                <SquareCheckBig />
                Check in {cardShouldBeAssigned && "and assign card"}
            </Button>
        </div>
    );
};

export default SubmitActions;
