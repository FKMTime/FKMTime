import { CircleCheck, RotateCcw } from "lucide-react";

import { Button } from "@/Components/ui/button";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { ApplicationQuickAction, QuickAction } from "@/lib/interfaces";
import { applicationQuickActions, quickActionsQuery } from "@/lib/quickActions";

interface QuickActionsProps {
    handleQuickAction: (action: ApplicationQuickAction) => void;
}

/** Built-in and shared quick actions: give an extra or resolve with a comment */
const QuickActions = ({ handleQuickAction }: QuickActionsProps) => {
    // The built-in actions first, then the competition's own
    const { data } = useLiveQuery(quickActionsQuery);
    const quickActions: ApplicationQuickAction[] = [
        ...applicationQuickActions,
        ...(data ?? []).map((q: QuickAction) => ({
            id: q.id,
            name: q.name,
            giveExtra: q.giveExtra,
            comment: q.comment,
        })),
    ];

    return quickActions.map((quickAction) => (
        <Button
            key={quickAction.id}
            type="button"
            variant="outline"
            size="sm"
            title={
                quickAction.giveExtra ? "Gives an extra attempt" : "Resolves"
            }
            onClick={() => handleQuickAction(quickAction)}
        >
            {quickAction.giveExtra ? (
                <RotateCcw className="text-primary" />
            ) : (
                <CircleCheck className="text-success" />
            )}
            {quickAction.name}
        </Button>
    ));
};

export default QuickActions;
