import { UserMinus, UserPlus } from "lucide-react";
import { KeyboardEvent, useState } from "react";

import { Button } from "@/Components/ui/button";
import { Input } from "@/Components/ui/input";
import { useConfirm } from "@/hooks/useConfirm";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { useToast } from "@/hooks/useToast";
import {
    addIntegratedLiveScoretaker,
    integratedLiveScoretakersQuery,
    removeIntegratedLiveScoretaker,
} from "@/lib/integratedLive";
import { IntegratedLiveScoretaker } from "@/lib/interfaces";
import { queryClient } from "@/lib/queryClient";

const refresh = () =>
    queryClient.invalidateQueries({
        queryKey: [integratedLiveScoretakersQuery.key],
    });

/**
 * The WCA users who may enter results besides the organisers and Delegates,
 * so someone else can be the connected person (SPEC-006 section 5). Changing
 * them needs someone who manages the competition on the WCA website.
 */
const Scoretakers = () => {
    const { toast } = useToast();
    const confirm = useConfirm();
    const { data } = useLiveQuery(integratedLiveScoretakersQuery);
    const [wcaId, setWcaId] = useState("");
    const [isAdding, setIsAdding] = useState(false);

    const report = (ok: boolean, message: string) =>
        toast(
            ok
                ? { title: message, variant: "success" }
                : {
                      title: "Error",
                      description: message,
                      variant: "destructive",
                  }
        );

    const add = async () => {
        if (!wcaId.trim()) return;
        setIsAdding(true);
        const { ok, message } = await addIntegratedLiveScoretaker(wcaId);
        setIsAdding(false);
        report(ok, message);
        if (ok) setWcaId("");
        void refresh();
    };

    // The card sits inside the settings form: Enter adds, it doesn't save
    const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        void add();
    };

    const remove = (scoretaker: IntegratedLiveScoretaker) =>
        confirm({
            title: `Remove ${scoretaker.name} from the scoretakers?`,
            description:
                "They can no longer enter results for this competition on the WCA website.",
            confirmLabel: "Remove",
            onConfirm: async () => {
                const { ok, message } = await removeIntegratedLiveScoretaker(
                    scoretaker.wcaUserId
                );
                report(ok, message);
                void refresh();
            },
        }).catch(() => undefined);

    if (!data) return null;

    return (
        <div className="space-y-2 rounded-xl border p-3">
            <p className="text-[13px] font-semibold text-muted-foreground">
                Scoretakers
            </p>
            <p className="text-[13px] text-muted-foreground">
                Besides organisers and Delegates, these WCA accounts may enter
                results, so one of them can be the connected account.
            </p>
            {!data.ok && data.message && (
                <p className="text-[13px] text-warning">{data.message}</p>
            )}
            {data.ok && data.scoretakers.length === 0 && (
                <p className="text-sm">No scoretakers yet.</p>
            )}
            {data.scoretakers.length > 0 && (
                <ul className="flex flex-col divide-y">
                    {data.scoretakers.map((scoretaker) => (
                        <li
                            key={scoretaker.wcaUserId}
                            className="flex items-center justify-between gap-2 py-1.5 text-sm"
                        >
                            {scoretaker.name}
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                aria-label={`Remove ${scoretaker.name}`}
                                onClick={() => remove(scoretaker)}
                            >
                                <UserMinus />
                            </Button>
                        </li>
                    ))}
                </ul>
            )}
            {data.ok && (
                <div className="flex gap-2">
                    <Input
                        aria-label="WCA ID"
                        placeholder="WCA ID, e.g. 2015EXAM01"
                        value={wcaId}
                        onChange={(e) => setWcaId(e.target.value)}
                        onKeyDown={onKeyDown}
                    />
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => void add()}
                        disabled={!wcaId.trim() || isAdding}
                    >
                        <UserPlus />
                        Add
                    </Button>
                </div>
            )}
        </div>
    );
};

export default Scoretakers;
