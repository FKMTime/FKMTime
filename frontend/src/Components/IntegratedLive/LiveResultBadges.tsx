import { StatusTone } from "@/Components/shared/status";
import { StatusBadge, StatusDot } from "@/Components/shared/StatusBadge";
import { ATTENTION_LABELS, isOnTheWay } from "@/lib/integratedLive";
import {
    IntegratedLiveResultView,
    IntegratedLiveRound,
} from "@/lib/interfaces";

const DOTS: Record<
    NonNullable<IntegratedLiveRound["dot"]>,
    { tone: StatusTone; label: string }
> = {
    notOpen: { tone: "neutral", label: "not open yet" },
    open: { tone: "primary", label: "open" },
    done: { tone: "success", label: "done" },
    attention: { tone: "warning", label: "needs attention" },
};

/** A round's state in WCA live results, as a dot in the round strip */
export const LiveRoundDot = ({ round }: { round?: IntegratedLiveRound }) => {
    if (!round?.dot) return null;
    const { tone, label } = DOTS[round.dot];
    return (
        <span title={`WCA live results: ${label}`} className="inline-flex">
            <StatusDot tone={tone} className="size-2" />
            <span className="sr-only">WCA live results: {label}</span>
        </span>
    );
};

/**
 * A result's state in WCA live results: sending, or needs attention with the
 * reason on hover. Confirmed results show nothing, to keep the table quiet.
 */
export const LiveSyncBadge = ({
    view,
}: {
    view?: IntegratedLiveResultView;
}) => {
    if (!view) return null;
    if (isOnTheWay(view.status)) {
        return <StatusBadge tone="neutral">Sending</StatusBadge>;
    }
    const attention = view.status ? ATTENTION_LABELS[view.status] : undefined;
    if (attention) {
        return (
            <span title={view.error ?? undefined}>
                <StatusBadge tone="warning">{attention}</StatusBadge>
            </span>
        );
    }
    if (view.differs) {
        return (
            <span title="WCA live results holds other attempts">
                <StatusBadge tone="warning">Differs</StatusBadge>
            </span>
        );
    }
    return null;
};

/** The WCA's advancing flag: sure to advance, or in an advancing place */
export const AdvancingBadge = ({
    view,
}: {
    view?: IntegratedLiveResultView;
}) => {
    if (view?.advancing === "advances") {
        return <StatusBadge tone="success">Advances</StatusBadge>;
    }
    if (view?.advancing === "mayAdvance") {
        return (
            <span title="In an advancing place for now">
                <StatusBadge tone="primary">May advance</StatusBadge>
            </span>
        );
    }
    return null;
};
