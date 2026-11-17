import { useAtomValue } from "jotai";
import { Zap } from "lucide-react";
import { useEffect, useState } from "react";

import { Modal } from "@/Components/Modal";
import ModalActions from "@/Components/ModalActions";
import { Button } from "@/Components/ui/button";
import { useIntegratedLiveRoundsToOpen } from "@/hooks/useIntegratedLiveRound";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { useToast } from "@/hooks/useToast";
import { activityCodeToName } from "@/lib/activities";
import { competitionAtom } from "@/lib/atoms";
import {
    competitionSettingsQuery,
    updateCompetitionSettings,
} from "@/lib/competition";
import { fetchQuery } from "@/lib/queryCache";
import { queryClient } from "@/lib/queryClient";
import { RoundToOpen } from "@/Pages/Main/Home/Components/IntegratedLiveRoundsToOpen";
import { socket } from "@/socket";

interface RoundsToOpenDialogProps {
    /** Official rounds the last save started */
    roundIds: string[];
    onClose: () => void;
}

const roundName = (roundId: string) =>
    activityCodeToName(roundId).replace(", ", " · ");

/** WCA Live can't be reached from FKMTime: someone opens the rounds there */
const WcaLiveRoundsDialog = ({
    roundIds,
    onClose,
}: RoundsToOpenDialogProps) => (
    <Modal
        isOpen={roundIds.length > 0}
        onClose={onClose}
        title="Open these rounds in WCA Live"
    >
        <p className="text-sm text-muted-foreground">
            Results can't be entered in WCA Live until their round is open.
        </p>
        <ul className="list-disc pl-5 text-sm">
            {roundIds.map((roundId) => (
                <li key={roundId} className="font-semibold">
                    {roundName(roundId)}
                </li>
            ))}
        </ul>
        <ModalActions>
            <Button onClick={onClose}>Done</Button>
        </ModalActions>
    </Modal>
);

/**
 * The rounds FKMTime didn't open in WCA Integrated Live Results by itself.
 * The backend decides when a round starts (first rounds open straight away,
 * later ones if the competition opted in and nothing argues against it) and
 * says so with `roundShouldBeOpened`.
 */
const IntegratedLiveRoundsDialog = ({
    roundIds,
    onClose,
}: RoundsToOpenDialogProps) => {
    const { toast } = useToast();
    const competition = useAtomValue(competitionAtom);
    // The panel's competition doesn't carry the settings; these do
    const { data: settings } = useLiveQuery(competitionSettingsQuery);
    const [shouldBeOpened, setShouldBeOpened] = useState<string[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    // Listen all the time: the event can arrive before the save returns
    useEffect(() => {
        const handle = ({ roundId }: { roundId: string }) =>
            setShouldBeOpened((prev) =>
                prev.includes(roundId) ? prev : [...prev, roundId]
            );
        socket.on("roundShouldBeOpened", handle);
        return () => {
            socket.off("roundShouldBeOpened", handle);
        };
    }, []);

    const toOpen = useIntegratedLiveRoundsToOpen(
        shouldBeOpened.filter((roundId) => roundIds.includes(roundId))
    );
    const offerAutomaticOpening =
        !!settings &&
        !settings.openRoundsAutomatically &&
        toOpen.some((round) => !round.roundId.endsWith("-r1"));

    const close = () => {
        setShouldBeOpened([]);
        onClose();
    };

    const openAutomatically = async () => {
        if (!competition) return;
        setIsSaving(true);
        const fresh = await fetchQuery(competitionSettingsQuery);
        const status = await updateCompetitionSettings(competition.id, {
            ...fresh,
            openRoundsAutomatically: true,
        });
        setIsSaving(false);
        if (status === 200) {
            void queryClient.invalidateQueries({
                queryKey: [competitionSettingsQuery.key],
            });
            toast({
                title: "Later rounds will open automatically",
                description:
                    "From the next round on. Open the rounds above yourself.",
                variant: "success",
            });
        } else {
            toast({
                title: "The setting could not be saved",
                variant: "destructive",
            });
        }
    };

    return (
        <Modal
            isOpen={toOpen.length > 0}
            onClose={close}
            title="Open rounds in WCA Live"
            className="sm:max-w-xl"
        >
            <div className="flex flex-col gap-3">
                {toOpen.map((round) => (
                    <RoundToOpen key={round.roundId} round={round} />
                ))}
            </div>
            <ModalActions>
                {offerAutomaticOpening && (
                    <Button
                        variant="outline"
                        onClick={openAutomatically}
                        disabled={isSaving}
                    >
                        <Zap />
                        Open later rounds automatically
                    </Button>
                )}
                <Button variant="ghost" onClick={close}>
                    Later
                </Button>
            </ModalActions>
        </Modal>
    );
};

/** After groups change: the rounds that just started and aren't open yet */
const RoundsToOpenDialog = (props: RoundsToOpenDialogProps) => {
    const competition = useAtomValue(competitionAtom);
    switch (competition?.officialResultsDestination) {
        case "NONE":
            return null;
        case "WCA_INTEGRATED_LIVE":
            return competition.integratedLiveConnection === "CONNECTED" ? (
                <IntegratedLiveRoundsDialog {...props} />
            ) : null;
        default:
            return <WcaLiveRoundsDialog {...props} />;
    }
};

export default RoundsToOpenDialog;
