import { Heading, List } from "@chakra-ui/react";

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
            <List.Root as="ul">
                {persons.map((attendance) => (
                    <List.Item key={attendance.id}>
                        {attendance.person.name}{" "}
                        {showDevice &&
                            attendance.device &&
                            ` - station ${attendance.device.name}`}
                        {!attendance.isAssigned && " (unassigned)"}
                    </List.Item>
                ))}
            </List.Root>
        </>
    );
};

export default UnorderedPeopleList;
