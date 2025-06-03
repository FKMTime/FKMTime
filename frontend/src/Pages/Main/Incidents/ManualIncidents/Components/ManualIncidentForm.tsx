import { zodResolver } from "@hookform/resolvers/zod";
import { Event, Round } from "@wca/helpers";
import { useAtomValue } from "jotai";
import { useForm } from "react-hook-form";
import { z } from "zod";

import ModalActions from "@/Components/ModalActions";
import PersonAutocomplete from "@/Components/PersonAutocomplete";
import { Button } from "@/Components/ui/button";
import {
    Form,
    FormControl,
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
import { Textarea } from "@/Components/ui/textarea";
import { competitionAtom } from "@/lib/atoms";
import { getEventShortName } from "@/lib/events";
import { ManualIncidentData } from "@/lib/interfaces";
import { manualIncidentSchema } from "@/lib/schema/manualIncidentSchema";

interface ManualIncidentFormProps {
    defaultValues?: ManualIncidentData;
    handleSubmit: (data: ManualIncidentData) => void;
    submitText: string;
    isLoading: boolean;
}
const ManualIncidentForm = ({
    defaultValues,
    handleSubmit,
    submitText,
    isLoading,
}: ManualIncidentFormProps) => {
    const competition = useAtomValue(competitionAtom);
    const form = useForm<z.infer<typeof manualIncidentSchema>>({
        resolver: zodResolver(manualIncidentSchema),
        defaultValues: {
            ...defaultValues,
            eventId: defaultValues?.roundId
                ? defaultValues.roundId.split("-")[0]
                : "",
        },
    });

    const onSubmit = (values: z.infer<typeof manualIncidentSchema>) => {
        handleSubmit({
            ...defaultValues,
            ...values,
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
                    name="personId"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Competitor</FormLabel>
                            <PersonAutocomplete
                                onSelect={(person) =>
                                    field.onChange(person?.id)
                                }
                                defaultValue={field.value}
                            />
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="eventId"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Event</FormLabel>
                            <Select
                                onValueChange={field.onChange}
                                value={field.value}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select event" />
                                </SelectTrigger>
                                <SelectContent>
                                    {competition?.wcif.events.map((event) => (
                                        <SelectItem
                                            key={event.id}
                                            value={event.id}
                                        >
                                            {getEventShortName(event.id)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="roundId"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Round</FormLabel>
                            <Select
                                value={field.value}
                                onValueChange={field.onChange}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select round" />
                                </SelectTrigger>
                                <SelectContent>
                                    {competition?.wcif.events
                                        .find(
                                            (event: Event) =>
                                                event.id ===
                                                form.watch("eventId")
                                        )
                                        ?.rounds.map(
                                            (round: Round, i: number) => (
                                                <SelectItem
                                                    key={round.id}
                                                    value={round.id}
                                                >
                                                    Round {i + 1}
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
                    name="attempt"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Attempt</FormLabel>
                            <FormControl>
                                <Input {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                                <Textarea
                                    placeholder="Description"
                                    {...field}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <ModalActions>
                    <Button
                        type="submit"
                        variant="success"
                        disabled={isLoading}
                    >
                        {submitText}
                    </Button>
                </ModalActions>
            </form>
        </Form>
    );
};

export default ManualIncidentForm;
