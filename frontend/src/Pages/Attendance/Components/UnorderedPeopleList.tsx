import { Heading, ListItem, UnorderedList } from "@chakra-ui/react";

import { StaffActivity } from "@/logic/interfaces";

interface PresentPeopleListProps {
    persons: StaffActivity[];
    showDevice?: boolean;
    heading?: string;
}

const UnorderedPeopleList = ({
    persons,
    showDevice,
    heading = "Present",
}: PresentPeopleListProps) => {
    return (
        <>
            <Heading size="md">{heading}</Heading>
            <UnorderedList>
                {persons.map((attendance) => (
                    <ListItem key={attendance.id}>
                        {attendance.person.name}{" "}
                        {showDevice &&
                            attendance.device &&
                            ` - station ${attendance.device.name}`}
                        {!attendance.isAssigned && " (unassigned)"}
                    </ListItem>
                ))}
            </UnorderedList>
        </>
    );
};

export default UnorderedPeopleList;
