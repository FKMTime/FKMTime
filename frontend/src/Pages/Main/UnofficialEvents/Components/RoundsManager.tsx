import { Round, RoundFormat } from "@wca/helpers";
import { Trash2 } from "lucide-react";
import { Dispatch, SetStateAction } from "react";

import AttemptResultInput from "@/Components/AttemptResultInput";
import IconButton from "@/Components/IconButton";
import PlusButton from "@/Components/PlusButton";
import { Checkbox } from "@/Components/ui/checkbox";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/Components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/Components/ui/table";
import { toast } from "@/hooks/useToast";
import { CUTOFF_ALLOWED } from "@/lib/constants";
import { roundFormats } from "@/lib/constants";

import {
    updateCumulativeLimit,
    updateCutoffInRounds,
    updateFormatInRounds,
    updateTimeLimitInRounds,
} from "../utils";

interface RoundsManagerProps {
    selectedEventId: string;
    rounds: Round[];
    setRounds: Dispatch<SetStateAction<Round[]>>;
}

const RoundsManager = ({
    selectedEventId,
    rounds,
    setRounds,
}: RoundsManagerProps) => {
    const addRound = () => {
        if (rounds.length >= 4) {
            return toast({
                title: "Error",
                description: "You cannot add more than 4 rounds",
                variant: "destructive",
            });
        }
        setRounds((prev) => {
            const newRounds = [...prev];
            newRounds.push({
                id: `${selectedEventId}-r${newRounds.length + 1}`,
                timeLimit: {
                    centiseconds: 60000,
                    cumulativeRoundIds: [],
                },
                cutoff: null,
                results: [],
                format: "a",
                advancementCondition: null,
                extensions: [],
            });
            return newRounds;
        });
    };

    const deleteLastRound = () => {
        if (rounds.length === 0) {
            return;
        }
        setRounds((prev) => {
            const newRounds = [...prev];
            newRounds.pop();
            return newRounds;
        });
    };

    const updateTimeLimit = (roundId: string, value: number) => {
        setRounds((prev) => {
            return updateTimeLimitInRounds(roundId, value, prev);
        });
    };

    const updateFormat = (roundId: string, value: RoundFormat) => {
        setRounds((prev) => {
            return updateFormatInRounds(roundId, value, prev);
        });
    };

    const updateCutoff = (roundId: string, value: number) => {
        setRounds((prev) => {
            return updateCutoffInRounds(roundId, value, prev);
        });
    };

    const updateCumulative = (roundId: string, value: boolean) => {
        setRounds((prev) => {
            return updateCumulativeLimit(roundId, value, prev);
        });
    };

    return (
        <div className="flex flex-col gap-5">
            <div className="flex gap-3">
                <PlusButton
                    onClick={addRound}
                    title="Add round"
                    aria-label="Add"
                />
                {rounds.length > 0 && (
                    <IconButton
                        filled
                        icon={<Trash2 />}
                        onClick={deleteLastRound}
                        title="Delete last round"
                    />
                )}
            </div>
            <Table>
                <TableHeader>
                    <TableHead>Round</TableHead>
                    <TableHead>Format</TableHead>
                    <TableHead>Time limit</TableHead>
                    <TableHead>Cumulative</TableHead>
                    <TableHead>Cutoff</TableHead>
                </TableHeader>
            </Table>
            <TableBody>
                {rounds.map((round, index) => (
                    <TableRow>
                        <TableCell>{`R${index + 1}`}</TableCell>
                        <TableCell>
                            <Select
                                value={round.format}
                                onValueChange={(value) =>
                                    updateFormat(round.id, value as RoundFormat)
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select format" />
                                </SelectTrigger>
                                <SelectContent>
                                    {roundFormats.map((format) => (
                                        <SelectItem
                                            key={format.format}
                                            value={format.format}
                                        >
                                            {format.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </TableCell>
                        <TableCell>
                            <AttemptResultInput
                                placeholder="Time limit"
                                value={round.timeLimit?.centiseconds ?? 0}
                                onChange={(value) =>
                                    updateTimeLimit(round.id, value)
                                }
                            />
                        </TableCell>
                        <TableCell className="flex items-center">
                            <Checkbox
                                checked={
                                    round.timeLimit?.cumulativeRoundIds &&
                                    round.timeLimit.cumulativeRoundIds.length >
                                        0
                                }
                                onCheckedChange={(e) =>
                                    updateCumulative(round.id, !!e)
                                }
                            />
                        </TableCell>
                        <TableCell>
                            {CUTOFF_ALLOWED.includes(round.format) && (
                                <AttemptResultInput
                                    placeholder="Cutoff"
                                    value={round.cutoff?.attemptResult ?? 0}
                                    onChange={(value) =>
                                        updateCutoff(round.id, value)
                                    }
                                />
                            )}
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </div>
    );
};

export default RoundsManager;
