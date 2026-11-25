import { zodResolver } from "@hookform/resolvers/zod";
import { Save } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import SwitchRow from "@/Components/shared/SwitchRow";
import { Button } from "@/Components/ui/button";
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/Components/ui/form";
import { Input } from "@/Components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/Components/ui/select";
import { BUZZER_VOLUME_DEFAULT } from "@/lib/constants";
import { Competition, SendingResultsFrequency } from "@/lib/interfaces";
import { isOrganizerOrDelegate } from "@/lib/permissions";
import {
    COMPETITION_FIELDS,
    CompetitionSettingsField,
    CompetitionSettingsInput,
    competitionSettingsSchema,
    DEVICE_FIELDS,
} from "@/lib/schema/competitionSchema";
import { prettySendingResultsFrequency } from "@/lib/utils";

import { AdvancedCard, DeviceFields, NetworkCard } from "./DeviceSettingsCards";
import IntegratedLiveConnection from "./IntegratedLiveConnection";
import ResultsDestination from "./ResultsDestination";
import Scoretakers from "./Scoretakers";
import SettingsCard from "./SettingsCard";

/** Which of the two parts of the settings, each with its own endpoint */
export interface SettingsParts {
    competition: boolean;
    devices: boolean;
}

interface CompetitionFormProps {
    competition: Competition;
    /**
     * Saves the parts marked as changed. Resolves to which parts are saved
     * now: true for a part that saved, or had nothing to save.
     */
    handleSubmit: (
        competition: Competition,
        changed: SettingsParts
    ) => Promise<SettingsParts>;
}

const CompetitionForm = ({
    competition,
    handleSubmit,
}: CompetitionFormProps) => {
    const form = useForm<
        CompetitionSettingsInput,
        unknown,
        z.output<typeof competitionSettingsSchema>
    >({
        resolver: zodResolver(competitionSettingsSchema),
        defaultValues: {
            // Unset on a new competition, like the WiFi details below
            scoretakingToken: competition.scoretakingToken ?? "",
            cubingContestsToken: competition.cubingContestsToken,
            sendingResultsFrequency: competition.sendingResultsFrequency,
            shouldChangeGroupsAutomatically:
                competition.shouldChangeGroupsAutomatically,
            useFkmTimeDevices: competition.useFkmTimeDevices,
            openRoundsAutomatically: competition.openRoundsAutomatically,
            shouldUpdateDevices: competition.shouldUpdateDevices,
            mdns: competition.mdns,
            wsUrl: competition.wsUrl || "",
            // Unset on a new competition; null would fail validation, and
            // its card may be hidden, so nothing could be saved
            wifiSsid: competition.wifiSsid ?? "",
            wifiPassword: competition.wifiPassword ?? "",
            defaultLocale: competition.defaultLocale ?? "en",
            hilTesting: competition.hilTesting ?? false,
            secureRfid: competition.secureRfid,
            soundEnabled: competition.soundEnabled,
            buzzerVolume: competition.buzzerVolume ?? BUZZER_VOLUME_DEFAULT,
        },
    });

    const [isSaving, setIsSaving] = useState(false);
    const { isDirty, dirtyFields, errors } = form.formState;
    // Errors exist only after a Save that failed validation. Some fields
    // are hidden (another results tool, devices off), so their own message
    // can't show: say it here, or Save would look like it did nothing
    const hasErrors = Object.keys(errors).length > 0;

    const onSubmit = async (
        values: z.output<typeof competitionSettingsSchema>
    ) => {
        const changedFields = Object.keys(
            dirtyFields
        ) as CompetitionSettingsField[];
        const changed = {
            competition: changedFields.some((f) =>
                COMPETITION_FIELDS.includes(f)
            ),
            devices: changedFields.some((f) => DEVICE_FIELDS.includes(f)),
        };
        setIsSaving(true);
        const saved = await handleSubmit(
            {
                ...competition,
                ...values,
                sendingResultsFrequency:
                    values.sendingResultsFrequency as SendingResultsFrequency,
                cubingContestsToken: values.cubingContestsToken || undefined,
            },
            changed
        );
        setIsSaving(false);
        // The saved values become the new baseline, which hides the bar
        if (saved.competition && saved.devices) {
            form.reset(values);
            return;
        }
        // One part failed: the part that saved becomes the baseline, and the
        // other stays changed, so the next Save sends only that part
        const current = form.getValues();
        const savedFields = [
            ...(saved.competition ? COMPETITION_FIELDS : []),
            ...(saved.devices ? DEVICE_FIELDS : []),
        ];
        const baseline = { ...form.formState.defaultValues };
        for (const field of savedFields) {
            Object.assign(baseline, { [field]: current[field] });
        }
        form.reset(baseline as CompetitionSettingsInput);
        for (const field of changedFields) {
            if (savedFields.includes(field)) continue;
            form.setValue(field, current[field] as never, {
                shouldDirty: true,
            });
        }
    };

    const useDevices = form.watch("useFkmTimeDevices");
    const usesIntegratedLive =
        competition.wcaScoretakingSoftware === "internal";
    // The WCA Live token only matters when results go there; before the
    // first read of the WCA setting it still decides, as before
    const showsScoretakingToken =
        !competition.wcaScoretakingSoftware ||
        competition.wcaScoretakingSoftware === "wca_live";

    const resultsCard = (
        <SettingsCard
            title="Results"
            description="Where official results go and how FKMTime sends them."
        >
            <ResultsDestination competition={competition} />
            {usesIntegratedLive && (
                <>
                    <IntegratedLiveConnection />
                    <FormField
                        control={form.control}
                        name="openRoundsAutomatically"
                        render={({ field }) => (
                            <SwitchRow
                                label="Open later rounds automatically"
                                description="Opening a round in WCA Integrated Live Results locks the round before it, so corrections there no longer change who advances. Off: FKMTime suggests opening and someone clicks. On: it opens the round itself when its first group starts, if every result of the previous round is confirmed and none is waiting for an extra."
                                checked={!!field.value}
                                onCheckedChange={field.onChange}
                            />
                        )}
                    />
                </>
            )}
            {showsScoretakingToken && (
                <FormField
                    control={form.control}
                    name="scoretakingToken"
                    render={({ field }) => (
                        <FormItem className="space-y-1.5">
                            <FormLabel className="text-[13px] font-semibold text-muted-foreground">
                                Scoretaking token
                            </FormLabel>
                            <FormControl>
                                <Input
                                    {...field}
                                    type="password"
                                    autoComplete="off"
                                    placeholder="Scoretaking token"
                                />
                            </FormControl>
                            <FormDescription className="text-[13px]">
                                You can get this token{" "}
                                <a
                                    className="text-primary hover:underline"
                                    href="https://live.worldcubeassociation.org/account"
                                    target="_blank"
                                    rel="noreferrer"
                                >
                                    on WCA Live
                                </a>
                                . It may expire after 7 days.
                            </FormDescription>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            )}
            {/* Every send waits for this, whatever the destination */}
            <FormField
                control={form.control}
                name="sendingResultsFrequency"
                render={({ field }) => (
                    <FormItem className="space-y-1.5">
                        <FormLabel className="text-[13px] font-semibold text-muted-foreground">
                            When to send results
                        </FormLabel>
                        <Select
                            onValueChange={field.onChange}
                            value={field.value}
                        >
                            <FormControl>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                {Object.values(SendingResultsFrequency).map(
                                    (frequency) => (
                                        <SelectItem
                                            key={frequency}
                                            value={frequency}
                                        >
                                            {prettySendingResultsFrequency(
                                                frequency
                                            )}
                                        </SelectItem>
                                    )
                                )}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                )}
            />
            {/* Unofficial events go to CubingContests, whatever the destination */}
            <FormField
                control={form.control}
                name="cubingContestsToken"
                render={({ field }) => (
                    <FormItem className="space-y-1.5">
                        <FormLabel className="text-[13px] font-semibold text-muted-foreground">
                            CubingContests token
                        </FormLabel>
                        <FormControl>
                            <Input
                                {...field}
                                value={field.value ?? ""}
                                autoComplete="off"
                                placeholder="Cubing contests API token"
                            />
                        </FormControl>
                        <FormDescription className="text-[13px]">
                            Only needed for unofficial events. You can get it{" "}
                            <a
                                className="text-primary hover:underline"
                                href={`https://cubingcontests.com/mod/competition?edit_id=${competition.wcaId}`}
                                target="_blank"
                                rel="noreferrer"
                            >
                                on CubingContests
                            </a>
                            .
                        </FormDescription>
                        <FormMessage />
                    </FormItem>
                )}
            />
        </SettingsCard>
    );

    return (
        <Form {...form}>
            <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="flex flex-col gap-4"
            >
                {/* One form across the cards: a single Save sends them all */}
                <div className="grid items-start gap-4 md:grid-cols-2">
                    {useDevices && (
                        <div className="flex min-w-0 flex-col gap-4">
                            {resultsCard}
                            {usesIntegratedLive && isOrganizerOrDelegate() && (
                                <Scoretakers />
                            )}
                            <NetworkCard />
                        </div>
                    )}
                    <div className="flex min-w-0 flex-col gap-4">
                        {useDevices && (
                            <SettingsCard
                                title="Competition day"
                                description="What FKMTime does on its own while groups run."
                            >
                                <FormField
                                    control={form.control}
                                    name="shouldChangeGroupsAutomatically"
                                    render={({ field }) => (
                                        <SwitchRow
                                            label="Change groups automatically"
                                            description="Group will be automatically changed to the next one from schedule if all results are entered and there are no unresolved incidents"
                                            checked={!!field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                    )}
                                />
                            </SettingsCard>
                        )}
                        <SettingsCard
                            title="Devices"
                            description="Whether stations and cards are used at this competition, and how they behave."
                        >
                            <FormField
                                control={form.control}
                                name="useFkmTimeDevices"
                                render={({ field }) => (
                                    <SwitchRow
                                        label="Use FKMTime devices"
                                        description="If you do not use FKMTime devices, you can disable some features of the app."
                                        checked={!!field.value}
                                        onCheckedChange={field.onChange}
                                    />
                                )}
                            />
                            {useDevices && <DeviceFields />}
                        </SettingsCard>
                        {/* Dev builds only: DEV is false at build time, so
                            a production bundle leaves the card out, and HIL
                            testing keeps the server's value, never changed */}
                        {import.meta.env.DEV && useDevices && <AdvancedCard />}
                    </div>
                </div>
                {isDirty && (
                    <div
                        role="region"
                        aria-label="Unsaved changes"
                        className="sticky bottom-[calc(max(env(safe-area-inset-bottom),0.375rem)+5rem)] z-10 flex items-center gap-2 rounded-xl border bg-card px-4 py-2.5 shadow-popover md:bottom-4"
                    >
                        {hasErrors ? (
                            <span
                                role="alert"
                                className="flex-1 text-[13px] font-semibold text-destructive"
                            >
                                Can't save: some settings aren't valid
                            </span>
                        ) : (
                            <span className="flex-1 text-[13px] font-semibold text-warning">
                                Unsaved changes
                            </span>
                        )}
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => form.reset()}
                            disabled={isSaving}
                        >
                            Discard
                        </Button>
                        <Button type="submit" disabled={isSaving}>
                            <Save />
                            Save
                        </Button>
                    </div>
                )}
            </form>
        </Form>
    );
};

export default CompetitionForm;
