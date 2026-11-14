import { StatusBadge } from "@/Components/shared/StatusBadge";
import { Button } from "@/Components/ui/button";
import { useConfirm } from "@/hooks/useConfirm";
import { useIntegratedLiveRound } from "@/hooks/useIntegratedLiveRound";
import { useToast } from "@/hooks/useToast";
import {
    ATTENTION_LABELS,
    clearIntegratedLiveResult,
    invalidateIntegratedLiveRounds,
    isOnTheWay,
} from "@/lib/integratedLive";
import { Attempt, IntegratedLiveResultView, Result } from "@/lib/interfaces";
import {
    attemptWithPenaltyToString,
    resultToString,
} from "@/lib/resultFormatters";
import { cn } from "@/lib/utils";

interface WcaLiveResultsCardProps {
    result: Result;
    /** FKMTime's counted attempts, in order */
    submittedAttempts: Attempt[];
}

const statusBadge = (view: IntegratedLiveResultView) => {
    if (isOnTheWay(view.status)) {
        return <StatusBadge tone="neutral">Sending</StatusBadge>;
    }
    const attention = view.status ? ATTENTION_LABELS[view.status] : undefined;
    if (attention) return <StatusBadge tone="warning">{attention}</StatusBadge>;
    if (view.differs) return <StatusBadge tone="warning">Differs</StatusBadge>;
    if (view.status === "CONFIRMED") {
        return <StatusBadge tone="success">Confirmed</StatusBadge>;
    }
    return <StatusBadge tone="neutral">Not sent yet</StatusBadge>;
};

/**
 * The result in WCA Integrated Live Results: sync status, the last send, the
 * reason when something is wrong, and the WCA's attempts when they differ
 * from FKMTime's (SPEC-006 section 5). Shows nothing unless results go there.
 */
const WcaLiveResultsCard = ({
    result,
    submittedAttempts,
}: WcaLiveResultsCardProps) => {
    const { byResultId } = useIntegratedLiveRound(result.roundId);
    const confirm = useConfirm();
    const { toast } = useToast();
    const view = byResultId.get(result.id);
    if (!view) return null;
    const registrationId = view.registrationId;

    const clear = () =>
        confirm({
            title: `Clear ${result.person.name} in WCA live results?`,
            description:
                "FKMTime sends its result again right after, so WCA live results ends up matching it.",
            confirmLabel: "Clear",
            onConfirm: async () => {
                if (registrationId === null) return;
                const { ok, message } = await clearIntegratedLiveResult(
                    result.roundId,
                    registrationId
                );
                toast(
                    ok
                        ? { title: message, variant: "success" }
                        : {
                              title: "Error",
                              description: message,
                              variant: "destructive",
                          }
                );
                void invalidateIntegratedLiveRounds();
            },
        }).catch(() => undefined);

    const ours = submittedAttempts.map(attemptWithPenaltyToString);
    const theirs = (view.wcaAttempts ?? []).map(resultToString);
    const length = Math.max(ours.length, theirs.length);

    return (
        <section
            aria-label="WCA live results"
            className="flex flex-col gap-2 rounded-mobile-card border bg-card px-5 py-[18px] md:rounded-2xl"
        >
            <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-faint">
                    WCA live results
                </p>
                {statusBadge(view)}
            </div>
            {view.sentAt && (
                <p className="text-[13px] text-muted-foreground">
                    Last sent {new Date(view.sentAt).toLocaleTimeString()}
                </p>
            )}
            {view.error && (
                <p className="text-[13px] text-warning">{view.error}</p>
            )}
            {view.differs && (
                <div className="flex flex-col gap-1 text-[13px]">
                    <p className="text-muted-foreground">
                        WCA live results holds other attempts. Clearing the
                        result there sends FKMTime's again.
                    </p>
                    <table className="w-full">
                        <thead>
                            <tr className="text-xs text-faint">
                                <th className="text-left font-semibold">#</th>
                                <th className="text-right font-semibold">
                                    FKMTime
                                </th>
                                <th className="text-right font-semibold">
                                    WCA
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {Array.from({ length }, (_, i) => {
                                const isDifferent = ours[i] !== theirs[i];
                                return (
                                    <tr
                                        key={i}
                                        className={cn(
                                            isDifferent &&
                                                "font-semibold text-warning"
                                        )}
                                    >
                                        <td>{i + 1}</td>
                                        <td className="text-right">
                                            {ours[i] ?? "—"}
                                        </td>
                                        <td className="text-right">
                                            {theirs[i] ?? "—"}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
            {registrationId !== null && !!view.wcaAttempts?.length && (
                <Button
                    variant="outline"
                    size="sm"
                    className="self-start"
                    onClick={clear}
                >
                    Clear in WCA live results
                </Button>
            )}
        </section>
    );
};

export default WcaLiveResultsCard;
