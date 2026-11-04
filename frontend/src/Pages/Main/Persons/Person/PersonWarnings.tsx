import { ShieldAlert, Trash2 } from "lucide-react";
import { useState } from "react";

import EmptyState from "@/Components/shared/EmptyState";
import RowActions from "@/Components/shared/RowActions";
import { Button } from "@/Components/ui/button";
import { useDeferredDelete } from "@/hooks/useDeferredDelete";
import { Person, Warning } from "@/lib/interfaces";
import { formatDayTime } from "@/lib/time";
import { deleteWarning } from "@/lib/warnings";

import IssueWarningModal from "../Components/IssueWarningModal";

interface PersonWarningsProps {
    person: Person;
    warnings: Warning[];
    onChange: () => void;
}

const PersonWarnings = ({
    person,
    warnings,
    onChange,
}: PersonWarningsProps) => {
    const [isIssueOpen, setIsIssueOpen] = useState(false);
    const { deleteLater, isPending } = useDeferredDelete({
        remove: deleteWarning,
        onDeleted: onChange,
    });

    const visibleWarnings = warnings.filter((item) => !isPending(item.id));

    return (
        <div className="flex flex-col gap-4">
            <div className="flex justify-end">
                <Button onClick={() => setIsIssueOpen(true)}>
                    <ShieldAlert />
                    Issue warning
                </Button>
            </div>

            {visibleWarnings.length === 0 ? (
                <EmptyState>No warnings issued.</EmptyState>
            ) : (
                <ul className="flex flex-col divide-y overflow-hidden rounded-mobile-card border bg-card md:rounded-2xl">
                    {visibleWarnings.map((warning) => (
                        <li
                            key={warning.id}
                            className="flex items-center gap-3 py-3 pl-4 pr-2 md:pl-5"
                        >
                            <div className="min-w-0 flex-1">
                                <p className="text-sm">{warning.description}</p>
                                <p className="text-xs text-faint">
                                    {[
                                        warning.createdBy?.fullName &&
                                            `by ${warning.createdBy.fullName}`,
                                        formatDayTime(warning.createdAt),
                                    ]
                                        .filter(Boolean)
                                        .join(" · ")}
                                </p>
                            </div>
                            <RowActions
                                subject={person.name}
                                primary={{
                                    label: "Delete warning",
                                    icon: Trash2,
                                    onSelect: () =>
                                        deleteLater(
                                            warning.id,
                                            `Warning for ${person.name} deleted`
                                        ),
                                }}
                            />
                        </li>
                    ))}
                </ul>
            )}

            <IssueWarningModal
                isOpen={isIssueOpen}
                onClose={() => {
                    setIsIssueOpen(false);
                    onChange();
                }}
                person={person}
            />
        </div>
    );
};

export default PersonWarnings;
