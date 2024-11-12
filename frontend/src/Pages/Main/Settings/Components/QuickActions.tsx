import { Flex, Heading } from "@chakra-ui/react";
import { useEffect, useState } from "react";

import PlusButton from "@/Components/PlusButton.tsx";
import { QuickAction } from "@/logic/interfaces.ts";
import { getQuickActions } from "@/logic/quickActions.ts";
import CreateQuickActionModal from "@/Pages/Main/Settings/Components/CreateQuickActionModal";
import QuickActionCard from "@/Pages/Main/Settings/Components/QuickActionCard";

const QuickActions = () => {
    const [quickActions, setQuickActions] = useState<QuickAction[]>([]);
    const [isOpenCreateQuickActionModal, setIsOpenCreateQuickActionModal] =
        useState<boolean>(false);

    const fetchData = async () => {
        const data = await getQuickActions();
        setQuickActions(data);
    };

    const handleCloseCreateQuickActionModal = () => {
        setIsOpenCreateQuickActionModal(false);
        fetchData();
    };

    useEffect(() => {
        fetchData();
    }, []);

    return (
        <Flex flexDirection="column" gap="5s">
            <Flex
                gap="3"
                flexDirection={{ base: "column", md: "row" }}
                alignItems={{ base: "flex-start", md: "center" }}
            >
                <Heading fontSize="3xl">Quick incident actions</Heading>
                <PlusButton
                    aria-label="Add quick action"
                    onClick={() => setIsOpenCreateQuickActionModal(true)}
                />
            </Flex>
            <Flex flexDirection="row" flexWrap="wrap" gap="5" mt="5">
                {quickActions.map((action) => (
                    <QuickActionCard
                        key={action.id}
                        quickAction={action}
                        fetchData={fetchData}
                    />
                ))}
            </Flex>
            <CreateQuickActionModal
                isOpen={isOpenCreateQuickActionModal}
                onClose={handleCloseCreateQuickActionModal}
            />
        </Flex>
    );
};

export default QuickActions;
