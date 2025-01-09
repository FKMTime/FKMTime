import { zodResolver } from "@hookform/resolvers/zod";
import { TimeLimit } from "@wca/helpers";
import { useForm } from "react-hook-form";
import { z } from "zod";

import AttemptResultInput from "@/Components/AttemptResultInput";
import DeviceSelect from "@/Components/DeviceSelect";
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/Components/ui/select";
import { useToast } from "@/hooks/useToast";
import { DNF_VALUE, DNS_VALUE } from "@/lib/constants";
import {
    Attempt,
    AttemptData,
    AttemptStatus,
    AttemptType,
} from "@/lib/interfaces";
import { createAttemptSchema } from "@/lib/schema/resultSchema";
import { prettyAttemptStatus, prettyAttemptType } from "@/lib/utils";

interface AttemptFormProps {
    attempt?: Attempt;
    competitorId?: string;
    handleSubmit: (data: AttemptData) => void;
    isLoading: boolean;
    roundId: string;
    timeLimit?: TimeLimit;
}

const AttemptForm = ({
    attempt,
    competitorId,
    handleSubmit,
    isLoading,
    roundId,
    timeLimit,
}: AttemptFormProps) => {
    const { toast } = useToast();
    const form = useForm<z.infer<typeof createAttemptSchema>>({
        resolver: zodResolver(createAttemptSchema),
        defaultValues: {
            type: attempt ? attempt.type : AttemptType.STANDARD_ATTEMPT,
            status: attempt ? attempt.status : AttemptStatus.STANDARD,
            competitorId: competitorId ? competitorId : "",
            judgeId: attempt?.judge ? attempt.judgeId : "",
            scramblerId: attempt?.scrambler ? attempt.scramblerId : "",
            deviceId: attempt ? attempt.deviceId : "",
            attemptNumber: attempt ? attempt.attemptNumber : 1,
            value: attempt ? attempt.value : 0,
            penalty: attempt ? attempt.penalty : 0,
            comment: attempt ? attempt.comment : "",
            replacedBy: attempt?.replacedBy
                ? attempt.replacedBy.toString()
                : "",
        },
    });

    const onSubmit = (values: z.infer<typeof createAttemptSchema>) => {
        if (!values.deviceId) {
            return toast({
                title: "Device is required",
                variant: "destructive",
            });
        }
        if (values.judgeId && values.competitorId === values.judgeId) {
            return toast({
                title: "Judge cannot be the same as competitor",
                variant: "destructive",
            });
        }
        if (values.scramblerId && values.competitorId === values.scramblerId) {
            return toast({
                title: "Scrambler cannot be the same as competitor",
                variant: "destructive",
            });
        }
        const data: AttemptData = {
            roundId,
            ...values,
            penalty: values.penalty ? +values.penalty : 0,
            judgeId: values.judgeId ? values.judgeId : undefined,
            scramblerId: values.scramblerId ? values.scramblerId : undefined,
            type: values.type as AttemptType,
            status: values.status as AttemptStatus,
            comment: values.comment ? values.comment : "",
            replacedBy: values.replacedBy ? +values.replacedBy : 0,
        };

        const isTimeRequired =
            data.status !== AttemptStatus.EXTRA_GIVEN &&
            data.penalty !== DNF_VALUE &&
            data.penalty !== DNS_VALUE;

        if (isTimeRequired && (!data.value || data.value === 0)) {
            toast({
                title: "Time is required",
                variant: "destructive",
            });
            return;
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
                    name="competitorId"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Competitor</FormLabel>
                            <PersonAutocomplete
                                onSelect={(person) =>
                                    field.onChange(person?.id)
                                }
                                defaultValue={field.value}
                                disabled={!!competitorId}
                            />

                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Type</FormLabel>
                            <Select
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                    {(
                                        Object.keys(AttemptType) as Array<
                                            keyof typeof AttemptType
                                        >
                                    ).map((key) => (
                                        <SelectItem key={key} value={key}>
                                            {prettyAttemptType(
                                                key as AttemptType
                                            )}
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
                    name="status"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Status</FormLabel>
                            <Select
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                                <SelectContent>
                                    {(
                                        Object.keys(AttemptStatus) as Array<
                                            keyof typeof AttemptStatus
                                        >
                                    ).map((status) => (
                                        <SelectItem key={status} value={status}>
                                            {prettyAttemptStatus(
                                                status as AttemptStatus
                                            )}
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
                <FormField
                    control={form.control}
                    name="scramblerId"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Scrambler</FormLabel>
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
                <FormField
                    control={form.control}
                    name="deviceId"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Device</FormLabel>
                            <DeviceSelect
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
                {form.watch("status") === AttemptStatus.EXTRA_GIVEN ? (
                    <FormField
                        control={form.control}
                        name="replacedBy"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Replaced by</FormLabel>
                                <Input
                                    type="number"
                                    placeholder="Replaced by"
                                    {...field}
                                />
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                ) : null}
                <Button type="submit" disabled={isLoading}>
                    Submit
                </Button>
            </form>
        </Form>
    );
};

export default AttemptForm;
