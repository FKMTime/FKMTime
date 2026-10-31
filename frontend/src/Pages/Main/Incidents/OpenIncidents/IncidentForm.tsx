import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { TimeLimit } from "wcif-helpers";
import { z } from "zod";

import AttemptResultInput from "@/Components/AttemptResultInput";
import PenaltySelect from "@/Components/PenaltySelect";
import PersonAutocomplete from "@/Components/PersonAutocomplete";
import InlineError from "@/Components/shared/InlineError";
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
    /** Offers extras for several attempts, when there are others to replace */
    handleGiveExtras?: (
        incident: Incident,
        isNoteworthy?: boolean,
        doNotRequireCards?: boolean
    ) => void;
    timeLimit?: TimeLimit;
}

const IncidentForm = ({
    editedIncident,
    isLoading,
    handleSubmit,
    handleDelete,
    handleGiveExtras,
    timeLimit,
}: IncidentFormProps) => {
    const { toast } = useToast();
    const [action, setAction] = useState<IncidentAction | null>(null);
    const [isNoteworthy, setIsNoteworthy] = useState<boolean>(false);
    const [doNotRequireCards, setDoNotRequireCards] = useState<boolean>(false);
    const [error, setError] = useState("");

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
        setError("");
        if (values.judgeId && values.competitorId === values.judgeId) {
            return setError("The judge can't be the competitor.");
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
            case IncidentAction.EXTRA_GIVEN_FOR_SEVERAL:
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
        if (action === IncidentAction.EXTRA_GIVEN_FOR_SEVERAL) {
            return handleGiveExtras?.(data, isNoteworthy, doNotRequireCards);
        }
        handleSubmit(data, isNoteworthy, doNotRequireCards);
    };

    return (
        <Form {...form}>
            <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="flex flex-col gap-4"
            >
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField
                        control={form.control}
                        name="attemptNumber"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Attempt number</FormLabel>
                                <Input
                                    inputMode="numeric"
                                    placeholder="Attempt number"
                                    value={field.value}
                                    onChange={(event) =>
                                        field.onChange(
                                            +event.target.value.replace(
                                                /\D/g,
                                                ""
                                            )
                                        )
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
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                <InlineError className="text-[13px]">{error}</InlineError>
                <div className="mt-1 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
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
                    {handleGiveExtras && (
                        <Button
                            variant="outline"
                            type="submit"
                            disabled={isLoading}
                            onClick={() =>
                                setAction(
                                    IncidentAction.EXTRA_GIVEN_FOR_SEVERAL
                                )
                            }
                        >
                            Give extras for several attempts
                        </Button>
                    )}
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
