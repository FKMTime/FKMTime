import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Modal } from "@/Components/Modal.tsx";
import QuickActions from "@/Components/QuickActions";
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
import { updateAttempt } from "@/lib/attempt";
import {
    ApplicationQuickAction,
    Attempt,
    AttemptStatus,
} from "@/lib/interfaces";
import { giveExtraAttemptSchema } from "@/lib/schema/resultSchema";

interface GiveExtraAttemptModalProps {
    isOpen: boolean;
    onClose: () => void;
    attempt: Attempt;
}

const GiveExtraAttemptModal = ({
    isOpen,
    onClose,
    attempt,
}: GiveExtraAttemptModalProps) => {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState<boolean>(false);

    const form = useForm<z.infer<typeof giveExtraAttemptSchema>>({
        resolver: zodResolver(giveExtraAttemptSchema),
        defaultValues: {
            comment: attempt.comment ?? "",
        },
    });

    const onSubmit = async (values: z.infer<typeof giveExtraAttemptSchema>) => {
        setIsLoading(true);
        const status = await updateAttempt({
            ...attempt,
            comment: values.comment,
            status: AttemptStatus.EXTRA_GIVEN,
        });
        if (status === 200) {
            toast({
                title: "Successfully given extra.",
                variant: "success",
            });
            onClose();
        } else {
            toast({
                title: "Error",
                description: "Something went wrong",
                variant: "destructive",
            });
        }
        setIsLoading(false);
    };

    const handleQuickAction = (action: ApplicationQuickAction) => {
        const data = {
            ...attempt,
            status: action.giveExtra
                ? AttemptStatus.EXTRA_GIVEN
                : AttemptStatus.RESOLVED,
            comment: action.comment || "",
        };
        onSubmit(data);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Give extra attempt">
            <div className="grid grid-cols-2 gap-4">
                <QuickActions handleQuickAction={handleQuickAction} />
            </div>
            <Form {...form}>
                <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="space-y-8 py-3"
                >
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
                    <Button type="submit" disabled={isLoading}>
                        Submit
                    </Button>
                </form>
            </Form>
        </Modal>
    );
};

export default GiveExtraAttemptModal;
