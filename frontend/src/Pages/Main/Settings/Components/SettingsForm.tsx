import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

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
import { Settings } from "@/lib/interfaces";
import { settingsSchema } from "@/lib/schema/settingsSchema";

interface SettingsFormProps {
    settings: Settings;
    handleSubmit: (settings: Settings) => void;
    isLoading: boolean;
}

const SettingsForm = ({
    settings,
    handleSubmit,
    isLoading,
}: SettingsFormProps) => {
    const form = useForm<z.infer<typeof settingsSchema>>({
        resolver: zodResolver(settingsSchema),
        defaultValues: {
            username: settings?.username || "",
        },
    });

    const onSubmit = (values: z.infer<typeof settingsSchema>) => {
        handleSubmit({
            ...settings,
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
                    name="username"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Username</FormLabel>
                            <FormControl>
                                <Input placeholder="Username" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <Button disabled={isLoading} type="submit" variant="success">
                    Save
                </Button>
            </form>
        </Form>
    );
};

export default SettingsForm;
