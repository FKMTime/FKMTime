import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/Components/ui/button";
import { Checkbox } from "@/Components/ui/checkbox";
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
    handleSubmit: (competition: Competition) => void;
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
        },
    });

    const onSubmit = (values: z.infer<typeof competitionSchema>) => {
        handleSubmit({
            ...competition,
            ...values,
            sendingResultsFrequency:
                values.sendingResultsFrequency as SendingResultsFrequency,
        });
    };

    return (
        <Form {...form}>
            <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-8 py-3"
            >
                <FormField
                    control={form.control}
                    name="scoretakingToken"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Scoretaking token</FormLabel>
                            <FormControl>
                                <Input
                                    {...field}
                                    placeholder="Scoretaking token"
                                />
                            </FormControl>
                            <FormDescription>
                                You can get this token{" "}
                                <a
                                    className="text-blue-500"
                                    href="https://live.worldcubeassociation.org/account"
                                    target="_blank"
                                >
                                    here
                                </a>
                            </FormDescription>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="cubingContestsToken"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>CubingContests token</FormLabel>
                            <FormControl>
                                <Input
                                    {...field}
                                    placeholder="Cubing contests API token"
                                />
                            </FormControl>
                            <FormDescription>
                                You can get this token{" "}
                                <a
                                    className="text-blue-500"
                                    href={`https://cubingcontests.com/mod/competition?edit_id=${competition.wcaId}`}
                                    target="_blank"
                                >
                                    here
                                </a>
                            </FormDescription>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="sendingResultsFrequency"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>
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
                <FormField
                    control={form.control}
                    name="shouldChangeGroupsAutomatically"
                    render={({ field }) => (
                        <FormItem>
                            <div className="flex items-center gap-2">
                                <FormControl>
                                    <Checkbox
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                    />
                                </FormControl>
                                <FormLabel>
                                    Change groups automatically
                                </FormLabel>
                            </div>
                            <FormDescription>
                                Group will be automatically changed to the next
                                one from schedule if all results are entered and
                                there are no unresolved incidents
                            </FormDescription>
                        </FormItem>
                    )}
                />
                <Button type="submit" variant="success">
                    Save
                </Button>
            </form>
        </Form>
    );
};

export default CompetitionForm;
