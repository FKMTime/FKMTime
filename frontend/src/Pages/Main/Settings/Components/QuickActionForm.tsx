import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/Components/ui/button";
import { Checkbox } from "@/Components/ui/checkbox";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/Components/ui/form";
import { Input } from "@/Components/ui/input";
import { QuickAction, QuickActionData } from "@/lib/interfaces";
import { quickActionSchema } from "@/lib/schema/quickActionsSchema";

interface QuickActionFormProps {
    quickAction?: QuickAction;
    handleSubmit: (data: QuickActionData) => void;
    isLoading: boolean;
}

const QuickActionForm = ({
    quickAction,
    handleSubmit,
    isLoading,
}: QuickActionFormProps) => {
    const form = useForm<z.infer<typeof quickActionSchema>>({
        resolver: zodResolver(quickActionSchema),
        defaultValues: {
            name: quickAction ? quickAction.name : "",
            comment: quickAction ? quickAction.comment : "",
            giveExtra: quickAction ? quickAction.giveExtra : false,
            isShared: quickAction ? quickAction.isShared : false,
        },
    });

    const onSubmit = (values: z.infer<typeof quickActionSchema>) => {
        handleSubmit(values);
    };
    return (
        <Form {...form}>
            <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-8 py-3"
            >
                <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Name</FormLabel>
                            <FormControl>
                                <Input placeholder="Name" {...field} />
                            </FormControl>
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
                            <FormControl>
                                <Input placeholder="Comment" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="giveExtra"
                    render={({ field }) => (
                        <FormItem>
                            <div className="flex items-center gap-2">
                                <FormControl>
                                    <Checkbox
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                    />
                                </FormControl>
                                <FormLabel>Give extra attempt</FormLabel>
                            </div>
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="isShared"
                    render={({ field }) => (
                        <FormItem>
                            <div className="flex items-center gap-2">
                                <FormControl>
                                    <Checkbox
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                    />
                                </FormControl>
                                <FormLabel>
                                    Share with other delegates
                                </FormLabel>
                            </div>
                        </FormItem>
                    )}
                />
                <Button variant="success" type="submit" disabled={isLoading}>
                    Save
                </Button>
            </form>
        </Form>
    );
};

export default QuickActionForm;
