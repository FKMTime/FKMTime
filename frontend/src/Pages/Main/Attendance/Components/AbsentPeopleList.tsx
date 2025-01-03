import { Heading, IconButton, List } from "@chakra-ui/react";
import { MdDone } from "react-icons/md";

import { StaffActivity } from "@/logic/interfaces.ts";

interface AbsentPeopleListProps {
    staffActivities: StaffActivity[];
    handleMarkAsPresent: (id: string) => void;
}

const AbsentPeopleList = ({
    staffActivities,
    handleMarkAsPresent,
}: AbsentPeopleListProps) => {
    return (
        <>
            <Heading size="md">Absent</Heading>
            <List.Root as="ul">
                {staffActivities.map((activity) => (
                    <List.Item
                        key={activity.id}
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
                            onClick={() => handleMarkAsPresent(activity.id)}
                        >
                            <MdDone />
                        </IconButton>
                        {activity.person.name}
                    </List.Item>
                ))}
            </List.Root>
        </>
    );
};

export default AbsentPeopleList;
