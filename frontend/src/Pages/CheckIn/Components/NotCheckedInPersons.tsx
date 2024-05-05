import {
    Box,
    Heading,
    IconButton,
    ListItem,
    UnorderedList,
} from "@chakra-ui/react";
import { MdDone } from "react-icons/md";

import { Person } from "@/logic/interfaces";

interface PersonsWithoutGiftpackCollectedProps {
    persons: Person[];
    handleClick: (id: string) => void;
}

const NotCheckedInPersons = ({
    persons,
    handleClick,
}: PersonsWithoutGiftpackCollectedProps) => {
    return (
        <Box>
            <Heading size="lg">Persons who not collected giftpack yet</Heading>
            <UnorderedList>
                {persons.map((person) => (
                    <ListItem
                        key={person.id}
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
                            onClick={() => handleClick(person.id)}
                        >
                            <MdDone />
                        </IconButton>
                        {person.name}{" "}
                        {person.registrantId && `(${person.registrantId})`}
                    </ListItem>
                ))}
            </UnorderedList>
        </Box>
    );
};

export default NotCheckedInPersons;
