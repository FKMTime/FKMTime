import { EllipsisVertical, LucideIcon } from "lucide-react";
import { Fragment, useState } from "react";

import { Button } from "@/Components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/Components/ui/dropdown-menu";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetTitle,
} from "@/Components/ui/sheet";
import { useIsMobile } from "@/hooks/useMobile";
import { cn } from "@/lib/utils";

export interface RowAction {
    label: string;
    icon: LucideIcon;
    onSelect: () => void;
    /** Shown last, in red, after a separator */
    destructive?: boolean;
    hidden?: boolean;
}

interface RowActionsProps {
    /** The one action shown as an icon button */
    primary?: RowAction;
    /** Everything else, in the ⋮ menu */
    items?: RowAction[];
    /** What the row is, e.g. the person's name; titles the mobile sheet */
    subject: string;
}

/** One primary icon button per row; the rest in a ⋮ menu (a sheet on mobile) */
const RowActions = ({ primary, items = [], subject }: RowActionsProps) => {
    const isMobile = useIsMobile();
    const [isSheetOpen, setIsSheetOpen] = useState(false);

    const visible = items.filter((item) => !item.hidden);
    const regular = visible.filter((item) => !item.destructive);
    const destructive = visible.filter((item) => item.destructive);
    const groups = [regular, destructive].filter((group) => group.length);
    const menuLabel = `More actions for ${subject}`;

    return (
        <div className="flex items-center justify-end gap-0.5">
            {primary && !primary.hidden && (
                <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={primary.onSelect}
                    aria-label={primary.label}
                    title={primary.label}
                >
                    <primary.icon />
                </Button>
            )}
            {groups.length > 0 &&
                (isMobile ? (
                    <>
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={menuLabel}
                            onClick={() => setIsSheetOpen(true)}
                        >
                            <EllipsisVertical />
                        </Button>
                        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                            <SheetContent
                                side="bottom"
                                hideClose
                                className="gap-0 px-2 pt-3"
                            >
                                <div className="mx-auto mb-1.5 h-1 w-9 rounded-full bg-border-strong" />
                                <SheetTitle className="px-3.5 pb-2.5 pt-1.5 text-[13px] font-semibold text-muted-foreground">
                                    {subject}
                                </SheetTitle>
                                <SheetDescription className="sr-only">
                                    {menuLabel}
                                </SheetDescription>
                                {groups.map((group, index) => (
                                    <Fragment key={index}>
                                        {index > 0 && (
                                            <div className="mx-3.5 my-1 h-px bg-border" />
                                        )}
                                        {group.map((item) => (
                                            <button
                                                key={item.label}
                                                onClick={() => {
                                                    setIsSheetOpen(false);
                                                    item.onSelect();
                                                }}
                                                className={cn(
                                                    "flex h-[52px] w-full items-center gap-3.5 rounded-chip px-3.5 text-left text-[15px] active:bg-accent [&>svg]:size-[22px]",
                                                    item.destructive
                                                        ? "text-destructive"
                                                        : "[&>svg]:text-muted-foreground"
                                                )}
                                            >
                                                <item.icon />
                                                {item.label}
                                            </button>
                                        ))}
                                    </Fragment>
                                ))}
                            </SheetContent>
                        </Sheet>
                    </>
                ) : (
                    <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={menuLabel}
                            >
                                <EllipsisVertical />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                            align="end"
                            className="min-w-[200px]"
                        >
                            {groups.map((group, index) => (
                                <Fragment key={index}>
                                    {index > 0 && <DropdownMenuSeparator />}
                                    {group.map((item) => (
                                        <DropdownMenuItem
                                            key={item.label}
                                            onSelect={item.onSelect}
                                            className={cn(
                                                item.destructive &&
                                                    "text-destructive focus:text-destructive [&>svg]:text-destructive!"
                                            )}
                                        >
                                            <item.icon />
                                            {item.label}
                                        </DropdownMenuItem>
                                    ))}
                                </Fragment>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                ))}
        </div>
    );
};

export default RowActions;
