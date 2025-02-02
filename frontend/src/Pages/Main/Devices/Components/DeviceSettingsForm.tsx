import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/Components/ui/button";
import { Checkbox } from "@/Components/ui/checkbox";
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/Components/ui/form";
import { Input } from "@/Components/ui/input";
import { Competition } from "@/lib/interfaces";
import { deviceSettingsSchema } from "@/lib/schema/deviceSchema";

interface DeviceSettingsFormProps {
    competition: Competition;
    handleSubmit: (competition: Competition) => void;
}

const DeviceSettingsForm = ({
    competition,
    handleSubmit,
}: DeviceSettingsFormProps) => {
    const form = useForm<z.infer<typeof deviceSettingsSchema>>({
        resolver: zodResolver(deviceSettingsSchema),
        defaultValues: {
            shouldUpdateDevices: competition.shouldUpdateDevices,
            mdns: competition.mdns,
            wsUrl: competition.wsUrl,
            wifiSsid: competition.wifiSsid,
            wifiPassword: competition.wifiPassword,
        },
    });

    const onSubmit = (values: z.infer<typeof deviceSettingsSchema>) => {
        handleSubmit({
            ...competition,
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
                    name="shouldUpdateDevices"
                    render={({ field }) => (
                        <FormItem>
                            <div className="flex items-center gap-2">
                                <FormControl>
                                    <Checkbox
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                    />
                                </FormControl>
                                <FormLabel>Update devices</FormLabel>
                            </div>
                            <FormMessage />
                            <FormDescription>
                                Turn it off if competition is in progress
                            </FormDescription>
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="mdns"
                    render={({ field }) => (
                        <FormItem>
                            <div className="flex items-center gap-2">
                                <FormControl>
                                    <Checkbox
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                    />
                                </FormControl>
                                <FormLabel>Auto server discovery</FormLabel>
                            </div>
                            <FormMessage />
                            <FormDescription>
                                Use MDNS to search for a server in local network
                            </FormDescription>
                        </FormItem>
                    )}
                />
                {form.watch("mdns") === false && (
                    <>
                        <FormField
                            control={form.control}
                            name="wsUrl"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>
                                        micro-connector ws URL
                                    </FormLabel>
                                    <FormControl>
                                        <Input {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </>
                )}
                <FormField
                    control={form.control}
                    name="wifiSsid"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>WiFi SSID</FormLabel>
                            <FormControl>
                                <Input {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="wifiPassword"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>WiFi password</FormLabel>
                            <FormControl>
                                <Input {...field} type="password" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <Button
                    type="submit"
                    variant="success"
                    disabled={form.formState.isSubmitting}
                >
                    Save
                </Button>
            </form>
        </Form>
    );
};

export default DeviceSettingsForm;
