import { ChevronDown, ChevronUp, Plus } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import GiveDelegateAccessModal from "@/Components/GiveDelegateAccessModal";
import EmptyState from "@/Components/shared/EmptyState";
import RequestError from "@/Components/shared/RequestError";
import SectionLoading from "@/Components/shared/SectionLoading";
import { StatusBadge } from "@/Components/shared/StatusBadge";
import { Button } from "@/Components/ui/button";
import { useConfirm } from "@/hooks/useConfirm";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { useToast } from "@/hooks/useToast";
import {
    DelegateGrant,
    delegateGrantActionsQuery,
    delegateGrantsQuery,
    endDelegateGrant,
    grantState,
    grantUserName,
    invalidateDelegateGrants,
    PERMISSION_OPTIONS,
} from "@/lib/delegateGrants";
import { LIVE_MAX_AGE } from "@/lib/queryCache";
import { roomsQuery } from "@/lib/rooms";

const STATE_BADGE = {
    active: { tone: "primary", label: "Active" },
    waiting: { tone: "neutral", label: "Starts with the group" },
    ended: { tone: "neutral", label: "Ended" },
} as const;

const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
    });

const isToday = (iso: string) =>
    new Date(iso).toDateString() === new Date().toDateString();

/** What a grant allows besides resolving incidents, in words */
const allowedLabel = (grant: DelegateGrant) => {
    const labels = PERMISSION_OPTIONS.filter((option) =>
        grant.permissions.includes(option.value)
    ).map((option) => option.label.toLowerCase());
    return labels.length
        ? `Resolve incidents, ${labels.join(", ")}`
        : "Resolve incidents";
};

const GrantActions = ({ grantId }: { grantId: string }) => {
    const { data: actions } = useLiveQuery(delegateGrantActionsQuery(grantId));
    if (!actions) return <SectionLoading label="Loading actions" />;
    if (actions.length === 0)
        return <p className="text-sm text-muted-foreground">Nothing yet.</p>;
    return (
        <ol className="flex flex-col gap-1.5" aria-label="What they did">
            {actions.map((action) => (
                <li key={action.id} className="flex gap-3 text-sm">
                    <span className="w-12 shrink-0 tabular-nums text-faint">
                        {formatTime(action.createdAt)}
                    </span>
                    <span className="min-w-0">
                        {action.personName && (
                            <>
                                {action.resultId ? (
                                    <Link
                                        to={`/results/${action.resultId}`}
                                        className="font-semibold text-primary hover:underline"
                                    >
                                        {action.personName}
                                    </Link>
                                ) : (
                                    <span className="font-semibold">
                                        {action.personName}
                                    </span>
                                )}
                                {" · "}
                            </>
                        )}
                        {action.summary}
                    </span>
                </li>
            ))}
        </ol>
    );
};

const GrantRow = ({ grant }: { grant: DelegateGrant }) => {
    const confirm = useConfirm();
    const { toast } = useToast();
    const [isOpen, setIsOpen] = useState(grantState(grant) === "active");
    const state = grantState(grant);
    const badge = STATE_BADGE[state];
    const name = grantUserName(grant);

    const handleEnd = () =>
        confirm({
            title: `End ${name}'s delegate access?`,
            description: "They can't resolve incidents from now on.",
            confirmLabel: "End access",
            onConfirm: async () => {
                const status = await endDelegateGrant(grant.id);
                if (status === 200) {
                    toast({ title: "Delegate access ended" });
                    void invalidateDelegateGrants();
                } else {
                    toast({
                        title: "Error",
                        description: "Something went wrong",
                        variant: "destructive",
                    });
                }
            },
        }).catch(() => undefined);

    return (
        <li className="flex flex-col gap-3 px-4 py-3 md:px-5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <p className="font-semibold">{name}</p>
                <p className="text-sm text-muted-foreground">
                    {grant.groupName}
                </p>
                <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
                <div className="ml-auto flex items-center gap-1">
                    {state !== "ended" && (
                        <Button
                            variant="destructive-ghost"
                            size="sm"
                            onClick={handleEnd}
                        >
                            End
                        </Button>
                    )}
                    <Button
                        variant="ghost"
                        size="sm"
                        aria-expanded={isOpen}
                        onClick={() => setIsOpen(!isOpen)}
                    >
                        {grant.actionCount}{" "}
                        {grant.actionCount === 1 ? "action" : "actions"}
                        {isOpen ? <ChevronUp /> : <ChevronDown />}
                    </Button>
                </div>
            </div>
            <p className="text-xs text-faint">
                {allowedLabel(grant)}
                {grant.createdBy?.fullName &&
                    ` · given by ${grant.createdBy.fullName}`}
                {grant.endedBy?.fullName &&
                    ` · ended by ${grant.endedBy.fullName}`}
            </p>
            {isOpen && <GrantActions grantId={grant.id} />}
        </li>
    );
};

/**
 * Who has delegate access for a group, and what they did with it
 * (SPEC-013). Updates live: the layout keeps delegates in the room.
 */
const DelegateAccess = () => {
    const {
        data: grants,
        isError,
        refetch,
    } = useLiveQuery(delegateGrantsQuery(), { maxAge: LIVE_MAX_AGE });
    const { data: rooms } = useLiveQuery(roomsQuery);
    const [isGiving, setIsGiving] = useState(false);
    const runningGroupIds = [
        ...new Set((rooms ?? []).flatMap((room) => room.currentGroupIds)),
    ];

    const current = (grants ?? []).filter(
        (grant) => grantState(grant) !== "ended"
    );
    const endedToday = (grants ?? []).filter(
        (grant) =>
            grantState(grant) === "ended" &&
            !!grant.endedAt &&
            isToday(grant.endedAt)
    );

    return (
        <div className="flex flex-col gap-4">
            {isError && (
                <RequestError
                    hasData={!!grants}
                    onRetry={() => void refetch()}
                />
            )}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                    Let someone resolve the incidents of one group while it
                    runs. Give it from a room on Home for the next group too.
                </p>
                <Button
                    onClick={() => setIsGiving(true)}
                    disabled={runningGroupIds.length === 0}
                >
                    <Plus />
                    Give delegate access
                </Button>
            </div>

            {!grants ? (
                <SectionLoading label="Loading delegate access" />
            ) : current.length === 0 && endedToday.length === 0 ? (
                <EmptyState>Nobody has delegate access for a group.</EmptyState>
            ) : (
                <>
                    {current.length > 0 && (
                        <ul
                            aria-label="Current delegate access"
                            className="flex flex-col divide-y overflow-hidden rounded-mobile-card border bg-card md:rounded-2xl"
                        >
                            {current.map((grant) => (
                                <GrantRow key={grant.id} grant={grant} />
                            ))}
                        </ul>
                    )}
                    {endedToday.length > 0 && (
                        <section className="flex flex-col gap-2">
                            <h2 className="text-sm font-semibold text-faint">
                                Ended today
                            </h2>
                            <ul
                                aria-label="Ended delegate access"
                                className="flex flex-col divide-y overflow-hidden rounded-mobile-card border bg-card md:rounded-2xl"
                            >
                                {endedToday.map((grant) => (
                                    <GrantRow key={grant.id} grant={grant} />
                                ))}
                            </ul>
                        </section>
                    )}
                </>
            )}

            {isGiving && (
                <GiveDelegateAccessModal
                    isOpen
                    onClose={() => setIsGiving(false)}
                    groupIds={runningGroupIds}
                />
            )}
        </div>
    );
};

export default DelegateAccess;
