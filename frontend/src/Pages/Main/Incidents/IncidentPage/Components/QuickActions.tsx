import { Button, GridItem, Heading, SimpleGrid } from "@chakra-ui/react";
import { useEffect, useState } from "react";

import { ApplicationQuickAction, QuickAction } from "@/lib/interfaces";
import { applicationQuickActions, getQuickActions } from "@/lib/quickActions";

interface QuickActionsProps {
    handleQuickAction: (action: ApplicationQuickAction) => void;
}

const QuickActions = ({ handleQuickAction }: QuickActionsProps) => {
    const [quickActions, setQuickActions] = useState<ApplicationQuickAction[]>(
        applicationQuickActions
    );
    useEffect(() => {
        getQuickActions().then((data) => {
            setQuickActions([
                ...applicationQuickActions,
                ...data.map((q: QuickAction) => {
                    return {
                        id: q.id,
                        name: q.name,
                        color: "gray",
                        giveExtra: q.giveExtra,
                        comment: q.comment,
                    };
                }),
            ]);
        });
    }, []);
    return (
        <>
            <Heading size="lg">Quick actions</Heading>
            <SimpleGrid columns={2} spacing={4}>
                {quickActions.map((quickAction) => (
                    <GridItem key={quickAction.id}>
                        <Button
                            key={quickAction.id}
                            width="100%"
                            colorScheme={quickAction.color}
                            onClick={() => handleQuickAction(quickAction)}
                        >
                            {quickAction.name}
                        </Button>
                    </GridItem>
                ))}
            </SimpleGrid>
        </>
    );
};

export default QuickActions;
