import { zodResolver } from "@hookform/resolvers/zod";
import { Save } from "lucide-react";
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
                className="flex flex-col gap-4 md:gap-[18px]"
            >
                <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                        <FormItem className="space-y-1.5">
                            <FormLabel className="text-[13px] font-semibold text-muted-foreground">
                                Username
                            </FormLabel>
                            <FormControl>
                                <Input placeholder="Username" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <Button
                    disabled={isLoading}
                    type="submit"
                    className="w-full md:w-fit"
                >
                    <Save />
                    Save
                </Button>
            </form>
        </Form>
    );
};

export default SettingsForm;
