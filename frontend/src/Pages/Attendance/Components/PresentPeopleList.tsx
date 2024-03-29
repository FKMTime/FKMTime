import { Heading, ListItem, UnorderedList } from "@chakra-ui/react";

import { Attendance } from "@/logic/interfaces";

interface PresentPeopleListProps {
    persons: Attendance[];
    showDevice?: boolean;
}

const PresentPeopleList = ({ persons, showDevice }: PresentPeopleListProps) => {
    return (
        <>
            <Heading size="md">Present</Heading>
            <UnorderedList>
                {persons.map((attendance) => (
                    <ListItem key={attendance.id}>
                        {attendance.person.name}{" "}
                        {showDevice &&
                            attendance.device &&
                            `- station ${attendance.device.name}`}
                    </ListItem>
                ))}
            </UnorderedList>
        </>
    );
};

export default PresentPeopleList;
