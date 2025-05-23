import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Modal } from "@/Components/Modal";
import ModalActions from "@/Components/ModalActions";
import { Button } from "@/Components/ui/button";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/Components/ui/form";
import { Textarea } from "@/Components/ui/textarea";
import { useToast } from "@/hooks/useToast";
import { Person } from "@/lib/interfaces";
import { warningSchema } from "@/lib/schema/warningSchema";
import { issueWarning } from "@/lib/warnings";

interface IssueWarningModalProps {
    isOpen: boolean;
    onClose: () => void;
    person: Person;
}

const IssueWarningModal = ({
    isOpen,
    onClose,
    person,
}: IssueWarningModalProps) => {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);

    const form = useForm<z.infer<typeof warningSchema>>({
        resolver: zodResolver(warningSchema),
    });

    const onSubmit = async (values: z.infer<typeof warningSchema>) => {
        setIsLoading(true);
        const status = await issueWarning(person.id, values);
        if (status === 201) {
            toast({
                title: "Successfully issued warning.",
                variant: "success",
            });
            setIsLoading(false);
            form.reset();
            onClose();
        } else {
            toast({
                title: "Error",
                description: "Something went wrong",
                variant: "destructive",
            });
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Issue warning to ${person.name}`}
        >
            <Form {...form}>
                <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="space-y-8 py-3"
                >
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
                            Issue warning
                        </Button>
                    </ModalActions>
                </form>
            </Form>
        </Modal>
    );
};

export default IssueWarningModal;
