import { useEffect, useState } from "react";

import { Button } from "@/Components/ui/button";
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
                        giveExtra: q.giveExtra,
                        comment: q.comment,
                    };
                }),
            ]);
        });
    }, []);
    return quickActions.map((quickAction) => (
        <div key={quickAction.id}>
            <Button
                key={quickAction.id}
                className="w-full"
                variant={quickAction.giveExtra ? "success" : "destructive"}
                onClick={() => handleQuickAction(quickAction)}
            >
                {quickAction.name}
            </Button>
        </div>
    ));
};

export default QuickActions;
