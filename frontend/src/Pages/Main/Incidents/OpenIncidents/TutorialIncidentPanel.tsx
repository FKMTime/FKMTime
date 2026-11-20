import { X } from "lucide-react";
import { useState } from "react";

import AttemptResultInput from "@/Components/AttemptResultInput";
import PenaltySelect from "@/Components/PenaltySelect";
import QuickActions from "@/Components/QuickActions";
import { Button } from "@/Components/ui/button";
import { Checkbox } from "@/Components/ui/checkbox";
import { Label } from "@/Components/ui/label";
import { usePageHeader } from "@/hooks/usePageHeader";
import { useToast } from "@/hooks/useToast";
import { ApplicationQuickAction } from "@/lib/interfaces";
import { milisecondsToClockFormat } from "@/lib/resultFormatters";
import {
    deleteTutorialIncident,
    resolveTutorialIncident,
    TutorialIncident,
} from "@/lib/tutorial";

interface TutorialIncidentPanelProps {
    incident: TutorialIncident;
    onClose: () => void;
    /** After the incident was answered or deleted */
    onDone: () => void;
}

const GONE_STATUS = 404;

/**
 * Answers a delegate call made during a tutorial with the same choices as a
 * real incident. Nothing is saved: the answer only goes to the station, which
 * waits for it (SPEC-012)
 */
const TutorialIncidentPanel = ({
    incident,
    onClose,
    onDone,
}: TutorialIncidentPanelProps) => {
    const { toast } = useToast();
    const [value, setValue] = useState(incident.value);
    const [penalty, setPenalty] = useState(incident.penalty);
    const [doNotRequireCards, setDoNotRequireCards] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    usePageHeader({
        crumbs: [{ label: "Incidents" }],
        title: incident.competitorName,
        subtitle: "Tutorial",
        backTo: "/incidents",
    });

    const answered = (status: number, success: string) => {
        setIsLoading(false);
        if (status === 200) {
            toast({ title: success, variant: "success" });
            onDone();
        } else if (status === GONE_STATUS) {
            toast({
                title: "The station stopped waiting for this tutorial incident",
            });
            onDone();
        } else {
            toast({
                title: "Error",
                description: "Something went wrong",
                variant: "destructive",
            });
        }
    };

    const resolve = async (
        status: "RESOLVED" | "EXTRA_GIVEN",
        answer = { value, penalty }
    ) => {
        if (
            status === "RESOLVED" &&
            answer.value === 0 &&
            answer.penalty === 0
        ) {
            return toast({
                title: "Error",
                description:
                    "The time must be greater than 0 or DNF penalty should be applied",
                variant: "destructive",
            });
        }
        setIsLoading(true);
        answered(
            await resolveTutorialIncident(incident.id, {
                ...answer,
                status,
                doNotRequireCards,
            }),
            "Tutorial incident answered"
        );
    };

    const handleQuickAction = (action: ApplicationQuickAction) =>
        void resolve(action.giveExtra ? "EXTRA_GIVEN" : "RESOLVED", {
            value: incident.value,
            penalty: incident.penalty,
        });

    const handleDelete = async () => {
        setIsLoading(true);
        answered(
            await deleteTutorialIncident(incident.id),
            "Tutorial incident deleted"
        );
    };

    return (
        <section
            aria-label={`Tutorial incident: ${incident.competitorName}`}
            className="flex flex-col gap-5 rounded-mobile-card border bg-card p-4 md:rounded-2xl md:p-[22px] lg:sticky lg:top-[88px]"
        >
            <header className="flex items-start gap-3 max-md:hidden">
                <div className="min-w-0 flex-1">
                    <h2 className="truncate text-lg font-bold">
                        {incident.competitorName}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        Tutorial · {incident.deviceName}
                    </p>
                </div>
                <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={onClose}
                    aria-label="Close incident"
                >
                    <X />
                </Button>
            </header>

            <p className="rounded-lg bg-primary-soft px-3 py-2 text-sm">
                Tutorial: nothing here is saved. Your answer only goes back to
                the station.
            </p>

            <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold text-faint">
                    Quick actions
                </p>
                <div className="flex flex-wrap gap-2">
                    <QuickActions handleQuickAction={handleQuickAction} />
                </div>
            </div>

            {incident.inspectionTime ? (
                <p className="text-sm text-muted-foreground">
                    Inspection time:{" "}
                    <b className="font-semibold text-foreground">
                        {milisecondsToClockFormat(incident.inspectionTime)}
                    </b>
                </p>
            ) : null}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                    <Label>Time</Label>
                    <AttemptResultInput
                        value={value}
                        onChange={setValue}
                        disabled={isLoading}
                    />
                </div>
                <div className="flex flex-col gap-2">
                    <Label>Penalty</Label>
                    <PenaltySelect
                        value={penalty}
                        eventId="333"
                        onChange={setPenalty}
                        disabled={isLoading}
                    />
                </div>
            </div>
            <Label className="flex min-h-11 cursor-pointer items-center gap-3 font-normal md:min-h-0">
                <Checkbox
                    checked={doNotRequireCards}
                    onCheckedChange={(checked) =>
                        setDoNotRequireCards(!!checked)
                    }
                />
                <span>
                    Do not require cards to be scanned{" "}
                    <span className="text-faint">(bugs only)</span>
                </span>
            </Label>
            <div className="mt-1 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
                <Button
                    disabled={isLoading}
                    onClick={() => void resolve("RESOLVED")}
                >
                    Mark as resolved
                </Button>
                <Button
                    variant="outline"
                    disabled={isLoading}
                    onClick={() => void resolve("EXTRA_GIVEN")}
                >
                    Give extra
                </Button>
                <Button
                    variant="destructive-ghost"
                    disabled={isLoading}
                    onClick={() => void handleDelete()}
                    className="sm:ml-auto"
                >
                    Delete
                </Button>
            </div>
        </section>
    );
};

export default TutorialIncidentPanel;
