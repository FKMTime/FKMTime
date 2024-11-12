import { Heading, IconButton, ListItem, UnorderedList } from "@chakra-ui/react";
import { MdClose } from "react-icons/md";

import { StaffActivity } from "@/logic/interfaces.ts";

interface PresentPeopleListProps {
    staffActivities: StaffActivity[];
    handleMarkAsAbsent: (id: string) => void;
    showDevice?: boolean;
}

const PresentPeopleList = ({
    staffActivities,
    handleMarkAsAbsent,
    showDevice,
}: PresentPeopleListProps) => {
    return (
        <>
            <Heading size="md">Present</Heading>
            <UnorderedList>
                {staffActivities.map((activity) => (
                    <ListItem
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
                            onClick={() => handleMarkAsAbsent(activity.id)}
                        >
                            <MdClose />
                        </IconButton>
                        {activity.person.name}
                        {showDevice &&
                            activity.device &&
                            ` - station ${activity.device.name}`}
                        {!activity.isAssigned && " (unassigned)"}
                    </ListItem>
                ))}
            </UnorderedList>
        </>
    );
};

export default PresentPeopleList;
