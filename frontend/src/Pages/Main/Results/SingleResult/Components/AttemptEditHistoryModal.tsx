import { useEffect, useState } from "react";

import { Modal } from "@/Components/Modal";
import { Badge } from "@/Components/ui/badge";
import { getAttemptEditLog } from "@/lib/attempt";
import {
    AttemptEditLogEntry,
    AttemptStatus,
    AttemptType,
} from "@/lib/interfaces";
import { centisecondsToClockFormat } from "@/lib/resultFormatters";

interface AttemptEditHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    attemptId: string;
}

const formatValue = (value: number, penalty?: number) => {
    if (penalty === -1) return "DNF";
    if (penalty === -2) return "DNS";
    if (value === 0) return "—";
    const base = centisecondsToClockFormat(value);
    if (penalty && penalty > 0) return `${base} (+${penalty / 100}s)`;
    return String(base);
};

const formatStatus = (status: AttemptStatus) =>
    ({
        STANDARD: "Standard",
        UNRESOLVED: "Unresolved",
        RESOLVED: "Resolved",
        EXTRA_GIVEN: "Extra given",
        SCRAMBLED: "Scrambled",
    })[status] ?? status;

const formatType = (type: AttemptType) =>
    type === AttemptType.EXTRA_ATTEMPT ? "Extra" : "Standard";

type DiffField = { label: string; from?: string; to: string };

const initialFields = (entry: AttemptEditLogEntry): DiffField[] => {
    const fields: DiffField[] = [
        { label: "Result", to: formatValue(entry.value, entry.penalty) },
    ];
    if (entry.judge?.name)
        fields.push({ label: "Judge", to: entry.judge.name });
    if (entry.device?.name)
        fields.push({ label: "Station", to: entry.device.name });
    if (entry.scrambler?.name)
        fields.push({ label: "Scrambler", to: entry.scrambler.name });
    if (entry.status !== AttemptStatus.STANDARD)
        fields.push({ label: "Status", to: formatStatus(entry.status) });
    if (entry.type !== AttemptType.STANDARD_ATTEMPT)
        fields.push({ label: "Type", to: formatType(entry.type) });
    if (entry.attemptComment)
        fields.push({ label: "Comment", to: entry.attemptComment });
    return fields;
};

const diffEntries = (
    prev: AttemptEditLogEntry,
    curr: AttemptEditLogEntry
): DiffField[] => {
    const diffs: DiffField[] = [];

    if (prev.value !== curr.value || prev.penalty !== curr.penalty)
        diffs.push({
            label: "Result",
            from: formatValue(prev.value, prev.penalty),
            to: formatValue(curr.value, curr.penalty),
        });

    if (prev.status !== curr.status)
        diffs.push({
            label: "Status",
            from: formatStatus(prev.status),
            to: formatStatus(curr.status),
        });

    if (prev.type !== curr.type)
        diffs.push({
            label: "Type",
            from: formatType(prev.type),
            to: formatType(curr.type),
        });

    if (prev.attemptNumber !== curr.attemptNumber)
        diffs.push({
            label: "Attempt #",
            from: String(prev.attemptNumber),
            to: String(curr.attemptNumber),
        });

    if (prev.replacedBy !== curr.replacedBy)
        diffs.push({
            label: "Replaced by",
            from: prev.replacedBy ? `Extra ${prev.replacedBy}` : "None",
            to: curr.replacedBy ? `Extra ${curr.replacedBy}` : "None",
        });

    if (prev.judgeId !== curr.judgeId)
        diffs.push({
            label: "Judge",
            from: prev.judge?.name ?? "None",
            to: curr.judge?.name ?? "None",
        });

    if (prev.scramblerId !== curr.scramblerId)
        diffs.push({
            label: "Scrambler",
            from: prev.scrambler?.name ?? "None",
            to: curr.scrambler?.name ?? "None",
        });

    if (prev.deviceId !== curr.deviceId)
        diffs.push({
            label: "Station",
            from: prev.device?.name ?? "None",
            to: curr.device?.name ?? "None",
        });

    if (prev.attemptComment !== curr.attemptComment)
        diffs.push({
            label: "Comment",
            from: prev.attemptComment ?? "None",
            to: curr.attemptComment ?? "None",
        });

    return diffs;
};

const AttemptEditHistoryModal = ({
    isOpen,
    onClose,
    attemptId,
}: AttemptEditHistoryModalProps) => {
    const [log, setLog] = useState<AttemptEditLogEntry[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        setLoading(true);
        getAttemptEditLog(attemptId).then((data) => {
            setLog(Array.isArray(data) ? data : []);
            setLoading(false);
        });
    }, [isOpen, attemptId]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Edit history">
            <div className="flex flex-col gap-4 max-h-[70vh] overflow-y-auto pr-1">
                {loading && (
                    <p className="text-sm text-muted-foreground">Loading…</p>
                )}
                {!loading && log.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                        No history recorded for this attempt.
                    </p>
                )}
                {log.map((entry, i) => {
                    const prev = i > 0 ? log[i - 1] : null;
                    const fields = prev
                        ? diffEntries(prev, entry)
                        : initialFields(entry);

                    return (
                        <div key={entry.id} className="flex gap-3">
                            <div className="flex flex-col items-center">
                                <div className="w-2.5 h-2.5 rounded-full bg-primary mt-1 shrink-0" />
                                {i < log.length - 1 && (
                                    <div className="w-px flex-1 bg-border mt-1" />
                                )}
                            </div>
                            <div className="pb-4 flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                    <span className="text-xs text-muted-foreground">
                                        {new Date(
                                            entry.editedAt
                                        ).toLocaleString()}
                                    </span>
                                    {entry.comment && (
                                        <Badge
                                            variant="outline"
                                            className="text-xs"
                                        >
                                            {entry.comment}
                                        </Badge>
                                    )}
                                    {entry.editedBy?.fullName && (
                                        <span className="text-xs text-muted-foreground">
                                            by {entry.editedBy.fullName}
                                        </span>
                                    )}
                                </div>

                                {fields.length > 0 ? (
                                    <div className="flex flex-col gap-0.5">
                                        {fields.map((d) => (
                                            <div
                                                key={d.label}
                                                className="text-sm flex items-center gap-1.5"
                                            >
                                                <span className="text-xs text-muted-foreground w-20 shrink-0">
                                                    {d.label}
                                                </span>
                                                {d.from !== undefined && (
                                                    <>
                                                        <span className="line-through text-muted-foreground">
                                                            {d.from}
                                                        </span>
                                                        <span className="text-muted-foreground">
                                                            →
                                                        </span>
                                                    </>
                                                )}
                                                <span className="font-medium">
                                                    {d.to}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-xs text-muted-foreground">
                                        No field changes detected.
                                    </p>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </Modal>
    );
};

export default AttemptEditHistoryModal;
