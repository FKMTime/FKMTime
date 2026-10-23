import { useAtomValue } from "jotai";
import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getLimitByRoundId } from "wcif-helpers";

import LoadingPage from "@/Components/LoadingPage";
import QuickActions from "@/Components/QuickActions";
import { Button } from "@/Components/ui/button";
import { useConfirm } from "@/hooks/useConfirm";
import { usePageHeader } from "@/hooks/usePageHeader";
import { useToast } from "@/hooks/useToast";
import { activityCodeToName } from "@/lib/activities";
import { competitionAtom } from "@/lib/atoms";
import { deleteAttempt, getIncidentById, updateAttempt } from "@/lib/attempt";
import {
    ApplicationQuickAction,
    AttemptStatus,
    Incident,
} from "@/lib/interfaces";
import { milisecondsToClockFormat } from "@/lib/resultFormatters";

import IncidentForm from "./IncidentForm";
import PreviousExtras from "./PreviousExtras";

interface IncidentPanelProps {
    id: string;
    onClose: () => void;
    /** After the incident was resolved, given an extra or deleted */
    onDone: () => void;
}

const IncidentPanel = ({ id, onClose, onDone }: IncidentPanelProps) => {
    const { toast } = useToast();
    const confirm = useConfirm();
    const competition = useAtomValue(competitionAtom);
    const [incident, setIncident] = useState<Incident | null>(null);
    const [previousIncidents, setPreviousIncidents] = useState<Incident[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        getIncidentById(id).then((data) => {
            setIncident(data.attempt);
            setPreviousIncidents(data.previousIncidents);
        });
    }, [id]);

    const roundName = incident
        ? activityCodeToName(incident.result.roundId).replace(", ", " · ")
        : "";

    usePageHeader({
        crumbs: [{ label: "Incidents" }],
        title: incident?.result.person.name ?? "Incident",
        subtitle: roundName,
        backTo: "/incidents",
    });

    const timeLimit = useMemo(() => {
        if (!competition || !incident) return undefined;
        return (
            getLimitByRoundId(incident.result.roundId, competition.wcif) ??
            undefined
        );
    }, [competition, incident]);

    const handleSubmit = async (
        data: Incident,
        isNoteworthy?: boolean,
        doNotRequireCards?: boolean
    ) => {
        if (
            data.value === 0 &&
            data.penalty === 0 &&
            data.status !== AttemptStatus.EXTRA_GIVEN
        ) {
            return toast({
                title: "Error",
                description:
                    "The time must be greater than 0 or DNF penalty should be applied",
                variant: "destructive",
            });
        }
        setIsLoading(true);
        const { status, message } = await updateAttempt(
            data,
            isNoteworthy,
            doNotRequireCards
        );
        setIsLoading(false);
        if (status === 200) {
            toast({ title: "Incident saved", variant: "success" });
            onDone();
        } else {
            toast({
                title: "Error",
                description:
                    message ?? "An error occurred while updating the incident",
                variant: "destructive",
            });
        }
    };

    const handleQuickAction = (action: ApplicationQuickAction) => {
        if (!incident) return;
        handleSubmit({
            ...incident,
            status: action.giveExtra
                ? AttemptStatus.EXTRA_GIVEN
                : AttemptStatus.RESOLVED,
            comment: action.comment || "",
            updateReplacedBy: false,
        });
    };

    const handleDelete = () => {
        if (!incident) return;
        confirm({
            title: "Delete this attempt?",
            description: "This action cannot be undone.",
            confirmLabel: "Delete attempt",
            onConfirm: async () => {
                setIsLoading(true);
                const response = await deleteAttempt(incident.id);
                setIsLoading(false);
                if (response.status === 200) {
                    onDone();
                } else {
                    toast({
                        title: "Error",
                        description: "Something went wrong",
                        variant: "destructive",
                    });
                }
            },
        }).catch(() => undefined);
    };

    if (!incident) return <LoadingPage />;

    return (
        <section
            aria-label={`Incident: ${incident.result.person.name}`}
            className="flex flex-col gap-5 rounded-mobile-card border bg-card p-4 md:rounded-2xl md:p-[22px] lg:sticky lg:top-[88px]"
        >
            <header className="flex items-start gap-3 max-md:hidden">
                <div className="min-w-0 flex-1">
                    <h2 className="truncate text-lg font-bold">
                        {incident.result.person.name}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        {[roundName, incident.device?.name]
                            .filter(Boolean)
                            .join(" · ")}
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

            <PreviousExtras previousIncidents={previousIncidents} />

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

            <IncidentForm
                editedIncident={incident}
                handleSubmit={handleSubmit}
                isLoading={isLoading}
                timeLimit={timeLimit}
                handleDelete={handleDelete}
            />
        </section>
    );
};

export default IncidentPanel;
