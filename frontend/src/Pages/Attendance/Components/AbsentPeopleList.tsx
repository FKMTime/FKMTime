import { Heading, IconButton, ListItem, UnorderedList } from "@chakra-ui/react";
import { Person } from "@wca/helpers";
import { MdDone } from "react-icons/md";

interface AbsentPeopleListProps {
    persons: Person[];
    handleMarkAsPresent: (registrantId: number, role: string) => void;
    role: string;
}

const AbsentPeopleList = ({
    persons,
    handleMarkAsPresent,
    role,
}: AbsentPeopleListProps) => {
    return (
        <>
            <Heading size="md">Absent</Heading>
            <UnorderedList>
                {persons.map((person) => (
                    <ListItem
                        key={person.registrantId}
                        display="flex"
                        gap="2"
                        alignItems="center"
                    >
                        <IconButton
                            aria-label="Mark as present"
                            rounded="20%"
                            background="none"
                            _hover={{ background: "none", opacity: 0.5 }}
                            color="white"
                            onClick={() =>
                                handleMarkAsPresent(person.registrantId, role)
                            }
                        >
                            <MdDone />
                        </IconButton>
                        {person.name}
                    </ListItem>
                ))}
            </UnorderedList>
        </>
    );
};

export default AbsentPeopleList;
