import {
    Box,
    Button,
    ButtonGroup,
    Card,
    CardBody,
    CardFooter,
    Divider,
    Heading,
    Link,
    Stack,
    Text,
} from "@chakra-ui/react";
import { Competition } from "@wca/helpers";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getPersonFromWcif } from "wcif-helpers";

import Avatar from "@/Components/Avatar/Avatar";
import EventIcon from "@/Components/Icons/EventIcon";
import FlagIcon from "@/Components/Icons/FlagIcon";
import { isAdmin } from "@/lib/auth";
import { Person } from "@/lib/interfaces";
import { WCA_ORIGIN } from "@/lib/request";
import { prettyGender, regionNameByIso2 } from "@/logic/utils";

import AssignCardModal from "./AssignCardModal";
import DisplayGroupsModal from "./DisplayGroupsModal";

interface PersonCardProps {
    person: Person;
    wcif: Competition;
    handleCloseEditModal: () => void;
}

const PersonCard = ({
    person,
    wcif,
    handleCloseEditModal,
}: PersonCardProps) => {
    const navigate = useNavigate();
    const [isOpenAssignCardModal, setIsOpenAssignCardModal] =
        useState<boolean>(false);
    const [isOpenDisplayGroupsModal, setIsOpenDisplayGroupsModal] =
        useState<boolean>(false);
    const wcifInfo = person.registrantId
        ? getPersonFromWcif(person.registrantId, wcif)
        : null;

    const handleCloseAssignCardModal = async () => {
        handleCloseEditModal();
        setIsOpenAssignCardModal(false);
    };
    return (
        <>
            <Card backgroundColor="gray.400">
                <CardBody>
                    <Box
                        display="flex"
                        gap={2}
                        alignItems="center"
                        justifyContent="space-between"
                    >
                        <Box display="flex" gap={2} alignItems="center">
                            <Avatar
                                avatarSize={30}
                                avatarUrl={wcifInfo?.avatar?.thumbUrl}
                                fullAvatarUrl={wcifInfo?.avatar?.url}
                                username={person.name}
                            />
                            <Heading size="md">
                                {person.name}{" "}
                                {person.registrantId &&
                                    `(${person.registrantId})`}
                            </Heading>
                        </Box>
                        {person.countryIso2 && (
                            <Box display="flex" alignItems="center" gap="1">
                                <FlagIcon
                                    country={person.countryIso2}
                                    size={40}
                                />
                            </Box>
                        )}
                    </Box>
                    <Stack mt="6" spacing="3">
                        {person.wcaId && (
                            <Text>
                                WCA ID:{" "}
                                <Link
                                    target="_blank"
                                    href={`${WCA_ORIGIN}/persons/${person.wcaId}`}
                                >
                                    {person.wcaId}
                                </Link>
                            </Text>
                        )}
                        {person.countryIso2 && (
                            <Text>
                                Representing:{" "}
                                {regionNameByIso2(person.countryIso2)}
                            </Text>
                        )}
                        <Text>Gender: {prettyGender(person.gender)}</Text>
                        <Box
                            display="flex"
                            flexDirection="row"
                            gap="2"
                            flexWrap="wrap"
                        >
                            {wcifInfo?.registration?.eventIds.map(
                                (event: string) => (
                                    <EventIcon
                                        key={event}
                                        eventId={event}
                                        selected={true}
                                        size={20}
                                    />
                                )
                            )}
                        </Box>
                        <Text>
                            Card assigned: {person.cardId ? "Yes" : "No"}
                        </Text>
                        <Text>
                            Checked in: {person.checkedInAt ? "Yes" : "No"}
                        </Text>
                        <Text>
                            Can compete: {person.canCompete ? "Yes" : "No"}
                        </Text>
                    </Stack>
                </CardBody>
                <Divider />
                <CardFooter>
                    <ButtonGroup spacing="2">
                        <Button
                            variant="solid"
                            colorScheme="blue"
                            onClick={() => setIsOpenAssignCardModal(true)}
                        >
                            Assign card
                        </Button>
                        {person.registrantId &&
                            person.registrantId !== 0 &&
                            isAdmin() && (
                                <>
                                    <Button
                                        variant="solid"
                                        colorScheme="green"
                                        onClick={() =>
                                            setIsOpenDisplayGroupsModal(true)
                                        }
                                    >
                                        Groups
                                    </Button>
                                    <Button
                                        variant="solid"
                                        colorScheme="purple"
                                        onClick={() =>
                                            navigate(
                                                `/persons/${person.id}/results`
                                            )
                                        }
                                    >
                                        Results
                                    </Button>
                                </>
                            )}
                    </ButtonGroup>
                </CardFooter>
            </Card>
            <AssignCardModal
                isOpen={isOpenAssignCardModal}
                onClose={handleCloseAssignCardModal}
                person={person}
            />
            {person.registrantId && person.registrantId !== 0 && (
                <DisplayGroupsModal
                    isOpen={isOpenDisplayGroupsModal}
                    onClose={() => setIsOpenDisplayGroupsModal(false)}
                    person={person}
                />
            )}
        </>
    );
};

export default PersonCard;
