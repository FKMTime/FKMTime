import { Pencil, Trash2, UserRound, UsersRound } from "lucide-react";
import { useState } from "react";

import RowActions from "@/Components/shared/RowActions";
import { TableCell, TableRow } from "@/Components/ui/table";
import { useToast } from "@/hooks/useToast";
import { QuickAction } from "@/lib/interfaces";
import { updateQuickAction } from "@/lib/quickActions";
import { cn } from "@/lib/utils";

import EditQuickActionModal from "./EditQuickActionModal";

interface QuickActionRowProps {
    quickAction: QuickAction;
    fetchData: () => void;
    onDelete: () => void;
    /** Desktop table row, or a mobile list item */
    variant?: "table" | "list";
}

const QuickActionRow = ({
    quickAction,
    fetchData,
    onDelete,
    variant = "table",
}: QuickActionRowProps) => {
    const { toast } = useToast();
    const [isOpenEditQuickActionModal, setIsOpenEditQuickActionModal] =
        useState(false);

    const handleCloseEditModal = () => {
        setIsOpenEditQuickActionModal(false);
        fetchData();
    };

    const handleToggleShare = async () => {
        const status = await updateQuickAction({
            ...quickAction,
            isShared: !quickAction.isShared,
        });
        if (status === 200) {
            toast({
                title: quickAction.isShared
                    ? "Quick action is now private"
                    : "Quick action shared with other delegates",
                variant: "success",
            });
            fetchData();
        } else {
            toast({
                title: "Error",
                description: "Something went wrong",
                variant: "destructive",
            });
        }
    };

    const result = (
        <span
            className={cn(
                "whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold",
                quickAction.giveExtra
                    ? "bg-primary-soft text-primary"
                    : "bg-success-soft text-success"
            )}
        >
            {quickAction.giveExtra ? "Gives extra" : "Resolves, no extra"}
        </span>
    );
    const SharedIcon = quickAction.isShared ? UsersRound : UserRound;
    const shared = (
        <span
            className={cn(
                "flex items-center gap-1.5 whitespace-nowrap",
                !quickAction.isShared && "text-muted-foreground"
            )}
        >
            <SharedIcon aria-hidden className="size-4" />
            {quickAction.isShared ? "Shared" : "Only me"}
        </span>
    );
    const actions = (
        <RowActions
            subject={quickAction.name}
            primary={{
                label: "Edit quick action",
                icon: Pencil,
                onSelect: () => setIsOpenEditQuickActionModal(true),
            }}
            items={[
                {
                    label: quickAction.isShared
                        ? "Stop sharing"
                        : "Share with other delegates",
                    icon: UsersRound,
                    onSelect: handleToggleShare,
                },
                {
                    label: "Delete quick action",
                    icon: Trash2,
                    destructive: true,
                    onSelect: onDelete,
                },
            ]}
        />
    );
    const modal = (
        <EditQuickActionModal
            isOpen={isOpenEditQuickActionModal}
            onClose={handleCloseEditModal}
            quickAction={quickAction}
        />
    );
    const comment = quickAction.comment || "—";
    const createdBy = quickAction.user.fullName;

    if (variant === "list")
        return (
            <li className="flex items-center gap-2.5 border-b py-2.5 pl-3.5 pr-1 last:border-b-0">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="truncate text-[15px] font-semibold">
                        {quickAction.name}
                    </span>
                    <span className="truncate text-[13px] text-muted-foreground">
                        {comment}
                    </span>
                    <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
                        {result}
                        {shared}
                        {createdBy && (
                            <span className="text-muted-foreground">
                                {createdBy}
                            </span>
                        )}
                    </span>
                </div>
                {actions}
                {modal}
            </li>
        );

    return (
        <TableRow>
            <TableCell className="whitespace-nowrap pl-5 font-semibold">
                {quickAction.name}
            </TableCell>
            <TableCell className="text-muted-foreground">{comment}</TableCell>
            <TableCell>{result}</TableCell>
            <TableCell>{shared}</TableCell>
            <TableCell className="whitespace-nowrap text-muted-foreground">
                {createdBy}
            </TableCell>
            <TableCell className="pr-3">
                {actions}
                {modal}
            </TableCell>
        </TableRow>
    );
};

export default QuickActionRow;
