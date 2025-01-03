import { Text } from "@chakra-ui/react";

import { Alert } from "@/Components/ui/alert";
import { Person } from "@/logic/interfaces.ts";
import regions from "@/logic/regions.ts";
import { isNewcomer } from "@/logic/utils";

interface PersonInfoProps {
    person: Person;
}

const PersonInfo = ({ person }: PersonInfoProps) => {
    return (
        <>
            {isNewcomer(person) && (
                <Alert status="warning">
                    Remember to check competitor's ID card
                </Alert>
            )}
            <Text fontSize="2xl" fontWeight="bold">
                Person information
            </Text>
            <Text fontSize="xl">Name: {person.name}</Text>
            {person.canCompete && (
                <>
                    <Text fontSize="xl">
                        Registrant ID: {person.registrantId}
                    </Text>
                    <Text fontSize="xl">
                        WCA ID: {person.wcaId ? person.wcaId : "Newcomer"}
                    </Text>
                    {person.birthdate && (
                        <Text fontSize="xl">
                            Birthdate:{" "}
                            {new Date(person.birthdate).toLocaleDateString()}
                        </Text>
                    )}
                    <Text fontSize="xl">
                        Representing:{" "}
                        {
                            regions.find(
                                (region) => region.iso2 === person.countryIso2
                            )?.name
                        }
                    </Text>
                </>
            )}
        </>
    );
};

export default PersonInfo;
