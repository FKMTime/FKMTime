import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { TimeLimit } from "wcif-helpers";
import { z } from "zod";

import AttemptResultInput from "@/Components/AttemptResultInput";
import PenaltySelect from "@/Components/PenaltySelect";
import PersonAutocomplete from "@/Components/PersonAutocomplete";
import { Button } from "@/Components/ui/button";
import { Checkbox } from "@/Components/ui/checkbox";
import {
    Form,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/Components/ui/form";
import { Input } from "@/Components/ui/input";
import { Label } from "@/Components/ui/label";
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
    handleSubmit: (
        incident: Incident,
        isNoteworthy?: boolean,
        doNotRequireCards?: boolean
    ) => void;
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
    const [isNoteworthy, setIsNoteworthy] = useState<boolean>(false);
    const [doNotRequireCards, setDoNotRequireCards] = useState<boolean>(false);

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
            deviceId: values.deviceId ? values.deviceId : undefined,
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
        handleSubmit(data, isNoteworthy, doNotRequireCards);
    };

    return (
        <Form {...form}>
            <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="flex flex-col gap-4"
            >
                <div className="grid gap-4 sm:grid-cols-2">
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
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
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
                </div>
                {editedIncident.scrambler ? (
                    <p className="text-sm text-muted-foreground">
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
                                value={field.value || ""}
                            />
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <Label className="flex min-h-11 cursor-pointer items-center gap-3 font-normal md:min-h-0">
                    <Checkbox
                        checked={isNoteworthy}
                        onCheckedChange={(value) => setIsNoteworthy(!!value)}
                    />
                    Mark as noteworthy incident
                </Label>
                <Label className="flex min-h-11 cursor-pointer items-center gap-3 font-normal md:min-h-0">
                    <Checkbox
                        checked={doNotRequireCards}
                        onCheckedChange={(value) =>
                            setDoNotRequireCards(!!value)
                        }
                    />
                    <span>
                        Do not require cards to be scanned{" "}
                        <span className="text-faint">(bugs only)</span>
                    </span>
                </Label>
                <div className="mt-1 flex flex-col gap-2.5 sm:flex-row">
                    <Button
                        type="submit"
                        disabled={isLoading}
                        onClick={() => setAction(IncidentAction.RESOLVED)}
                    >
                        Mark as resolved
                    </Button>
                    <Button
                        variant="outline"
                        type="submit"
                        disabled={isLoading}
                        onClick={() => setAction(IncidentAction.EXTRA_GIVEN)}
                    >
                        Save and give extra
                    </Button>
                    <Button
                        variant="destructive-ghost"
                        onClick={handleDelete}
                        type="button"
                        disabled={isLoading}
                        className="sm:ml-auto"
                    >
                        Delete attempt
                    </Button>
                </div>
            </form>
        </Form>
    );
};

export default IncidentForm;
