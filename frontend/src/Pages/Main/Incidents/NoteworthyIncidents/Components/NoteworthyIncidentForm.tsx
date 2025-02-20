import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

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
import { Input } from "@/Components/ui/input";
import { Textarea } from "@/Components/ui/textarea";
import { NoteworthyIncidentData } from "@/lib/interfaces";
import { noteworthyIncidentSchema } from "@/lib/schema/noteworthyIncidentSchema";

interface NoteworthyIncidentFormProps {
    defaultValues: NoteworthyIncidentData;
    handleSubmit: (data: NoteworthyIncidentData) => void;
    submitText: string;
    isLoading: boolean;
}
const NoteworthyIncidentForm = ({
    defaultValues,
    handleSubmit,
    submitText,
    isLoading,
}: NoteworthyIncidentFormProps) => {
    const form = useForm<z.infer<typeof noteworthyIncidentSchema>>({
        resolver: zodResolver(noteworthyIncidentSchema),
        defaultValues: {
            ...defaultValues,
        },
    });

    const onSubmit = (values: z.infer<typeof noteworthyIncidentSchema>) => {
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
                    name="title"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Title</FormLabel>
                            <FormControl>
                                <Input placeholder="Title" {...field} />
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

export default NoteworthyIncidentForm;
