import { useState } from "react";

import SegmentedControl from "@/Components/shared/SegmentedControl";
import { Button } from "@/Components/ui/button";
import { useToast } from "@/hooks/useToast";
import {
    BRACKET_SIZES,
    createBracket,
    defaultSetsToWin,
    getStages,
    H2hRoundView,
    SetsToWin,
    validateSetsToWin,
} from "@/lib/h2h";

import SetsToWinFields from "./SetsToWinFields";

interface BracketCreateFormProps {
    view: H2hRoundView;
}

/**
 * Size and sets to win per stage for a new bracket. The backend seeds it
 * from the previous round's ranking.
 */
const BracketCreateForm = ({ view }: BracketCreateFormProps) => {
    const { toast } = useToast();
    const [size, setSize] = useState(view.suggestedSize ?? 8);
    const [setsToWin, setSetsToWin] = useState<SetsToWin>(
        defaultSetsToWin(view.suggestedSize ?? 8)
    );
    const [isSaving, setIsSaving] = useState(false);
    const errors = validateSetsToWin(size, setsToWin);

    const changeSize = (next: number) => {
        setSize(next);
        setSetsToWin({ ...defaultSetsToWin(next), ...setsToWin });
    };

    const handleCreate = async () => {
        setIsSaving(true);
        const result = await createBracket(view.roundId, {
            size,
            setsToWin: Object.fromEntries(
                getStages(size).map((stage) => [stage, setsToWin[stage] ?? 1])
            ),
        });
        setIsSaving(false);
        if (!result.ok) {
            toast({
                title: "Bracket not created",
                description: result.message,
                variant: "destructive",
            });
            return;
        }
        toast({
            title: "Bracket created",
            description: result.view?.notice ?? undefined,
            variant: result.view?.notice ? "default" : "success",
        });
    };

    return (
        <section className="flex flex-col gap-5 rounded-mobile-card border bg-card p-4 md:rounded-2xl md:p-6">
            <div className="flex flex-col gap-1">
                <h2 className="text-lg font-semibold">Create the bracket</h2>
                <p className="text-sm text-muted-foreground">
                    Seeds follow the previous round's ranking. People tied there
                    are ordered randomly, and you can reorder or swap
                    competitors until the first match starts.
                </p>
            </div>
            {view.cannotCreate && (
                <p role="alert" className="text-sm text-destructive">
                    {view.cannotCreate}
                </p>
            )}
            <div className="flex flex-col gap-2">
                <span className="text-sm font-medium">Competitors</span>
                <SegmentedControl
                    label="Competitors"
                    variant="choice"
                    value={String(size)}
                    onValueChange={(value) => changeSize(+value)}
                    options={BRACKET_SIZES.map((option) => ({
                        value: String(option),
                        label: String(option),
                    }))}
                />
            </div>
            <div className="flex max-w-md flex-col gap-2">
                <span className="text-sm font-medium">Sets to win</span>
                <SetsToWinFields
                    size={size}
                    value={setsToWin}
                    onChange={setSetsToWin}
                />
            </div>
            <Button
                className="w-fit"
                onClick={handleCreate}
                disabled={
                    isSaving || errors.length > 0 || view.cannotCreate !== null
                }
            >
                Create bracket
            </Button>
        </section>
    );
};

export default BracketCreateForm;
