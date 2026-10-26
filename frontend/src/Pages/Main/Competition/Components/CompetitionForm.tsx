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
import { Competition, SendingResultsFrequency } from "@/lib/interfaces";
import { competitionSchema } from "@/lib/schema/competitionSchema";
import { prettySendingResultsFrequency } from "@/lib/utils";

interface CompetitionFormProps {
    competition: Competition;
    /** Resolves to whether the save worked */
    handleSubmit: (competition: Competition) => Promise<boolean>;
}

const CompetitionForm = ({
    competition,
    handleSubmit,
}: CompetitionFormProps) => {
    const form = useForm<z.infer<typeof competitionSchema>>({
        resolver: zodResolver(competitionSchema),
        defaultValues: {
            scoretakingToken: competition.scoretakingToken,
            cubingContestsToken: competition.cubingContestsToken,
            sendingResultsFrequency: competition.sendingResultsFrequency,
            shouldChangeGroupsAutomatically:
                competition.shouldChangeGroupsAutomatically,
            useFkmTimeDevices: competition.useFkmTimeDevices,
        },
    });

    const [isSaving, setIsSaving] = useState(false);
    const { isDirty } = form.formState;

    const onSubmit = async (values: z.infer<typeof competitionSchema>) => {
        setIsSaving(true);
        const isSaved = await handleSubmit({
            ...competition,
            ...values,
            sendingResultsFrequency:
                values.sendingResultsFrequency as SendingResultsFrequency,
            cubingContestsToken: values.cubingContestsToken || undefined,
        });
        setIsSaving(false);
        // The saved values become the new baseline, which hides the bar
        if (isSaved) form.reset(values);
    };

    const useDevices = form.watch("useFkmTimeDevices");

    return (
        <Form {...form}>
            <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="flex max-w-[560px] flex-col gap-4 md:gap-5"
            >
                {useDevices && (
                    <>
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
                                        Only needed for unofficial events. You
                                        can get it{" "}
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
                        <FormField
                            control={form.control}
                            name="sendingResultsFrequency"
                            render={({ field }) => (
                                <FormItem className="space-y-1.5">
                                    <FormLabel className="text-[13px] font-semibold text-muted-foreground">
                                        Send results to WCA Live/CubingContests
                                    </FormLabel>
                                    <Select
                                        onValueChange={field.onChange}
                                        defaultValue={field.value}
                                    >
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {Object.values(
                                                SendingResultsFrequency
                                            ).map((frequency) => (
                                                <SelectItem
                                                    key={frequency}
                                                    value={frequency}
                                                >
                                                    {prettySendingResultsFrequency(
                                                        frequency
                                                    )}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </>
                )}
                <div className="flex flex-col md:gap-2">
                    {useDevices && (
                        <FormField
                            control={form.control}
                            name="shouldChangeGroupsAutomatically"
                            render={({ field }) => (
                                <SwitchRow
                                    label="Change groups automatically"
                                    description="Group will be automatically changed to the next one from schedule if all results are entered and there are no unresolved incidents"
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                />
                            )}
                        />
                    )}
                    <FormField
                        control={form.control}
                        name="useFkmTimeDevices"
                        render={({ field }) => (
                            <SwitchRow
                                label="Use FKMTime devices"
                                description="If you do not use FKMTime devices, you can disable some features of the app."
                                checked={field.value}
                                onCheckedChange={field.onChange}
                            />
                        )}
                    />
                </div>
                {isDirty && (
                    <div
                        role="region"
                        aria-label="Unsaved changes"
                        className="sticky bottom-[calc(max(env(safe-area-inset-bottom),0.375rem)+5rem)] z-10 flex items-center gap-2 rounded-xl border bg-card px-4 py-2.5 shadow-popover md:bottom-4"
                    >
                        <span className="flex-1 text-[13px] font-semibold text-warning">
                            Unsaved changes
                        </span>
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
