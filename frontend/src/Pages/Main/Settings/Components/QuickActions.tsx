import { Plus } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/Components/ui/button";
import {
    Table,
    TableBody,
    TableHead,
    TableHeader,
    TableRow,
} from "@/Components/ui/table";
import { useDeferredDelete } from "@/hooks/useDeferredDelete";
import { useIsMobile } from "@/hooks/useMobile";
import { QuickAction } from "@/lib/interfaces";
import { deleteQuickAction, getQuickActions } from "@/lib/quickActions";

import CreateQuickActionModal from "./CreateQuickActionModal";
import QuickActionRow from "./QuickActionRow";

const QuickActions = () => {
    const isMobile = useIsMobile();
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

    const { deleteLater, isPending } = useDeferredDelete({
        remove: deleteQuickAction,
        onDeleted: fetchData,
    });
    const visibleQuickActions = quickActions.filter((q) => !isPending(q.id));
    const rowProps = (quickAction: QuickAction) => ({
        quickAction,
        fetchData,
        onDelete: () =>
            deleteLater(quickAction.id, `"${quickAction.name}" deleted`),
    });

    return (
        <section
            aria-labelledby="quick-actions"
            className="overflow-hidden rounded-mobile-card border bg-card md:rounded-2xl"
        >
            <div className="flex items-start gap-3 border-b px-3.5 py-3.5 md:flex-wrap md:px-5 md:py-[18px]">
                <div className="flex min-w-0 flex-1 flex-col gap-1 md:basis-[280px]">
                    <h2 id="quick-actions" className="text-base font-bold">
                        Quick actions
                    </h2>
                    <p className="text-pretty text-[13px] text-muted-foreground">
                        Shown as one-tap reasons when you give an extra attempt
                        or resolve an incident.
                    </p>
                </div>
                <Button
                    onClick={() => setIsOpenCreateQuickActionModal(true)}
                    size={isMobile ? "icon" : "default"}
                    aria-label="Add quick action"
                >
                    <Plus />
                    <span className="max-md:sr-only">Add quick action</span>
                </Button>
            </div>
            {visibleQuickActions.length === 0 ? (
                <p className="px-4 py-9 text-center text-sm text-muted-foreground">
                    No quick actions yet
                </p>
            ) : isMobile ? (
                <ul>
                    {visibleQuickActions.map((quickAction) => (
                        <QuickActionRow
                            key={quickAction.id}
                            {...rowProps(quickAction)}
                            variant="list"
                        />
                    ))}
                </ul>
            ) : (
                <Table className="min-w-[640px]">
                    <TableHeader>
                        <TableRow>
                            <TableHead className="pl-5">Name</TableHead>
                            <TableHead>Comment</TableHead>
                            <TableHead>Result</TableHead>
                            <TableHead>Shared</TableHead>
                            <TableHead>Created by</TableHead>
                            <TableHead>
                                <span className="sr-only">Actions</span>
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {visibleQuickActions.map((quickAction) => (
                            <QuickActionRow
                                key={quickAction.id}
                                {...rowProps(quickAction)}
                            />
                        ))}
                    </TableBody>
                </Table>
            )}
            <CreateQuickActionModal
                isOpen={isOpenCreateQuickActionModal}
                onClose={handleCloseCreateQuickActionModal}
            />
        </section>
    );
};

export default QuickActions;
