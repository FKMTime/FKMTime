import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import AttemptResultInput from "@/Components/AttemptResultInput";
import { Modal } from "@/Components/Modal";
import ModalActions from "@/Components/ModalActions";
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
import { createAttempt } from "@/lib/attempt";
import { DNF_VALUE, DNS_VALUE } from "@/lib/constants";
import { AttemptStatus, AttemptType } from "@/lib/interfaces";
import { getSubmissionPlatformName, prettyAttemptType } from "@/lib/utils";

const quickAttemptSchema = z.object({
    competitorId: z.string().min(1),
    attemptNumber: z.number().int().min(1),
    type: z.enum(["STANDARD_ATTEMPT", "EXTRA_ATTEMPT"]),
    value: z.number(),
    penalty: z.number(),
});

interface QuickEnterAttemptModalProps {
    isOpen: boolean;
    onClose: () => void;
    roundId: string;
}

const QuickEnterAttemptModal = ({
    isOpen,
    onClose,
    roundId,
}: QuickEnterAttemptModalProps) => {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const submissionPlatform = getSubmissionPlatformName(roundId.split("-")[0]);

    const form = useForm<z.infer<typeof quickAttemptSchema>>({
        resolver: zodResolver(quickAttemptSchema),
        defaultValues: {
            competitorId: "",
            attemptNumber: 1,
            type: AttemptType.STANDARD_ATTEMPT,
            value: 0,
            penalty: 0,
        },
    });

    const onSubmit = async (values: z.infer<typeof quickAttemptSchema>) => {
        const isTimeRequired =
            values.penalty !== DNF_VALUE && values.penalty !== DNS_VALUE;
        if (isTimeRequired && (!values.value || values.value === 0)) {
            toast({ title: "Time is required", variant: "destructive" });
            return;
        }
        setIsLoading(true);
        const { status, message } = await createAttempt({
            roundId,
            competitorId: values.competitorId,
            attemptNumber: values.attemptNumber,
            type: values.type as AttemptType,
            status: AttemptStatus.STANDARD,
            value: values.value,
            penalty: values.penalty,
            comment: "",
        });
        if (status === 201) {
            toast({
                title: `Attempt submitted to ${submissionPlatform}`,
                variant: "success",
            });
            form.reset();
            onClose();
        } else {
            toast({
                title: "Error",
                description: message ?? "Something went wrong",
                variant: "destructive",
            });
        }
        setIsLoading(false);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Quick enter attempt">
            <Form {...form}>
                <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="space-y-4"
                >
                    <FormField
                        control={form.control}
                        name="competitorId"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Competitor</FormLabel>
                                <PersonAutocomplete
                                    onSelect={(person) =>
                                        field.onChange(person?.id ?? "")
                                    }
                                    defaultValue={field.value}
                                />
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
                                    min={1}
                                    value={field.value}
                                    onChange={(e) =>
                                        field.onChange(+e.target.value)
                                    }
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
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {(
                                            Object.keys(
                                                AttemptType
                                            ) as AttemptType[]
                                        ).map((key) => (
                                            <SelectItem key={key} value={key}>
                                                {prettyAttemptType(key)}
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
                    <ModalActions>
                        <Button
                            type="submit"
                            variant="success"
                            disabled={isLoading}
                        >
                            Submit
                        </Button>
                    </ModalActions>
                </form>
            </Form>
        </Modal>
    );
};

export default QuickEnterAttemptModal;
