import SegmentedControl from "@/Components/shared/SegmentedControl";
import {
    getStages,
    H2hStage,
    MAX_SETS_TO_WIN,
    SetsToWin,
    STAGE_LABELS,
    validateSetsToWin,
} from "@/lib/h2h";

interface SetsToWinFieldsProps {
    size: number;
    value: SetsToWin;
    onChange: (value: SetsToWin) => void;
    /** Stages that have started keep their sets to win */
    lockedStages?: H2hStage[];
}

const OPTIONS = Array.from({ length: MAX_SETS_TO_WIN }, (_, i) => ({
    value: String(i + 1),
    label: String(i + 1),
}));

/** Sets to win per stage (I3a), with what the rules forbid explained */
const SetsToWinFields = ({
    size,
    value,
    onChange,
    lockedStages = [],
}: SetsToWinFieldsProps) => {
    const errors = validateSetsToWin(size, value);
    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
                {getStages(size).map((stage) => (
                    <div
                        key={stage}
                        className="flex items-center justify-between gap-3"
                    >
                        <span className="text-sm">{STAGE_LABELS[stage]}</span>
                        {lockedStages.includes(stage) ? (
                            <span className="text-sm text-muted-foreground">
                                {value[stage]} · started
                            </span>
                        ) : (
                            <SegmentedControl
                                label={`Sets to win in the ${STAGE_LABELS[stage]}`}
                                variant="choice"
                                options={OPTIONS}
                                value={String(value[stage] ?? 1)}
                                onValueChange={(sets) =>
                                    onChange({ ...value, [stage]: +sets })
                                }
                            />
                        )}
                    </div>
                ))}
            </div>
            {errors.length > 0 && (
                <ul role="alert" className="text-sm text-destructive">
                    {errors.map((error) => (
                        <li key={error}>{error}</li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default SetsToWinFields;
