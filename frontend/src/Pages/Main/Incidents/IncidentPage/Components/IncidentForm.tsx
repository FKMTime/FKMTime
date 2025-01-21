import { zodResolver } from "@hookform/resolvers/zod";
import { TimeLimit } from "@wca/helpers";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import AttemptResultInput from "@/Components/AttemptResultInput";
import PenaltySelect from "@/Components/PenaltySelect";
import PersonAutocomplete from "@/Components/PersonAutocomplete";
import { Button } from "@/Components/ui/button";
import {
    Form,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/Components/ui/form";
import { Input } from "@/Components/ui/input";
import { useToast } from "@/hooks/useToast";
import { DNF_VALUE } from "@/lib/constants";
import {
    AttemptStatus,
    AttemptType,
    Incident,
    IncidentAction,
} from "@/lib/interfaces";
import { getPersonNameAndRegistrantId } from "@/lib/persons";
import { createAttemptSchema } from "@/lib/schema/resultSchema";

interface IncidentFormProps {
    editedIncident: Incident;
    isLoading: boolean;
    handleSubmit: (incident: Incident) => void;
    handleDelete: () => void;
    timeLimit?: TimeLimit;
}

const IncidentForm = ({
    editedIncident,
    isLoading,
    handleSubmit,
    handleDelete,
    timeLimit,
}: IncidentFormProps) => {
    const { toast } = useToast();
    const [action, setAction] = useState<IncidentAction | null>(null);

    const form = useForm<z.infer<typeof createAttemptSchema>>({
        resolver: zodResolver(createAttemptSchema),
        defaultValues: {
            type: editedIncident.type,
            status: editedIncident.status,
            competitorId: editedIncident.result.person.id,
            judgeId: editedIncident?.judge ? editedIncident.judgeId : "",
            scramblerId: editedIncident?.scrambler
                ? editedIncident.scramblerId
                : "",
            deviceId: editedIncident.deviceId,
            attemptNumber: editedIncident.attemptNumber,
            value: editedIncident.value,
            penalty: editedIncident.penalty,
            comment: editedIncident.comment ? editedIncident.comment : "",
            replacedBy: editedIncident.replacedBy
                ? editedIncident.replacedBy.toString()
                : "",
        },
    });

    const onSubmit = (values: z.infer<typeof createAttemptSchema>) => {
        if (values.judgeId && values.competitorId === values.judgeId) {
            return toast({
                title: "Judge cannot be the same as competitor",
                variant: "destructive",
            });
        }

        const data: Incident = {
            ...editedIncident,
            ...values,
            penalty: values.penalty ? +values.penalty : 0,
            judgeId: values.judgeId ? values.judgeId : undefined,
            scramblerId: values.scramblerId ? values.scramblerId : undefined,
            type: values.type as AttemptType,
            status: values.status as AttemptStatus,
            comment: values.comment ? values.comment : "",
            replacedBy: values.replacedBy ? +values.replacedBy : 0,
        };

        switch (action) {
            case IncidentAction.RESOLVED:
                data.status = AttemptStatus.RESOLVED;
                break;
            case IncidentAction.EXTRA_GIVEN:
                data.status = AttemptStatus.EXTRA_GIVEN;
                break;
        }

        if (timeLimit) {
            if (data.value + data.penalty * 100 > timeLimit.centiseconds) {
                data.penalty = DNF_VALUE;
                toast({
                    title: "Time limit not passed, time was replaced to DNF",
                });
            }
        }
        handleSubmit(data);
    };

    return (
        <Form {...form}>
            <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-8 py-3"
            >
                <FormField
                    control={form.control}
                    name="attemptNumber"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Attempt number</FormLabel>
                            <Input
                                type="number"
                                placeholder="Attempt number"
                                value={field.value}
                                onChange={(event) =>
                                    field.onChange(+event.target.value)
                                }
                            />
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="value"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Time</FormLabel>
                            <AttemptResultInput
                                value={field.value}
                                onChange={field.onChange}
                                disabled={isLoading}
                            />
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="penalty"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Penalty</FormLabel>
                            <PenaltySelect
                                value={field.value}
                                onChange={field.onChange}
                                disabled={isLoading}
                            />
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="judgeId"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Judge</FormLabel>
                            <PersonAutocomplete
                                onSelect={(person) =>
                                    field.onChange(person?.id)
                                }
                                defaultValue={field.value as string}
                            />

                            <FormMessage />
                        </FormItem>
                    )}
                />
                {editedIncident.scrambler ? (
                    <p>
                        Scrambler:{" "}
                        {getPersonNameAndRegistrantId(editedIncident.scrambler)}
                    </p>
                ) : null}
                <FormField
                    control={form.control}
                    name="comment"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Comment</FormLabel>
                            <Input
                                type="text"
                                placeholder="Comment"
                                {...field}
                            />
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <div className="flex gap-4">
                    <Button
                        variant="secondary"
                        type="submit"
                        onClick={() => setAction(IncidentAction.RESOLVED)}
                    >
                        Mark as resolved
                    </Button>
                    <Button
                        variant="success"
                        type="submit"
                        onClick={() => setAction(IncidentAction.EXTRA_GIVEN)}
                    >
                        Save and give extra
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={handleDelete}
                        type="button"
                    >
                        Delete attempt
                    </Button>
                </div>
            </form>
        </Form>
    );
};

export default IncidentForm;
