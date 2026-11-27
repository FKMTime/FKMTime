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
import { useDialogError } from "@/hooks/useDialogError";
import { useToast } from "@/hooks/useToast";
import { updateAttempt } from "@/lib/attempt";
import { EXTRA_REMINDER, grantExtra } from "@/lib/h2h";
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
    roundId: string;
}

const GiveExtraAttemptModal = ({
    isOpen,
    onClose,
    attempt,
    roundId,
}: GiveExtraAttemptModalProps) => {
    // On a head-to-head point the extra goes to both competitors (SPEC-001)
    const pointId = attempt.h2hPointId ?? null;
    const [error, setError] = useDialogError(isOpen);
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
        const { status, message } = pointId
            ? await grantExtra(roundId, pointId, values.comment || "").then(
                  (granted) => ({
                      status: granted.ok ? 200 : 409,
                      message: granted.message,
                  })
              )
            : await updateAttempt({
                  ...attempt,
                  comment: values.comment || "",
                  status: AttemptStatus.EXTRA_GIVEN,
              });
        if (status === 200) {
            toast({ title: "Extra granted", variant: "success" });
            onClose();
        } else {
            setError(message ?? "Something went wrong");
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
    const title = pointId
        ? "Extra granted (both competitors)"
        : "Give extra attempt";

    return (
        <Modal error={error} isOpen={isOpen} onClose={onClose} title={title}>
            {pointId && (
                <p className="text-sm text-muted-foreground">
                    {EXTRA_REMINDER}
                </p>
            )}
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
                                    value={field.value || ""}
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
