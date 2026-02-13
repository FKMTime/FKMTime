import { zodResolver } from "@hookform/resolvers/zod";
import { Globe, KeyRound, Wifi } from "lucide-react";
import { useEffect, useState } from "react";
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/Components/ui/select";
import { getAvailableLocales } from "@/lib/competition";
import { AvailableLocale, Competition } from "@/lib/interfaces";
import { deviceSettingsSchema } from "@/lib/schema/deviceSchema";

interface DeviceSettingsFormProps {
    competition: Competition;
    handleSubmit: (competition: Competition) => void;
}

const DeviceSettingsForm = ({
    competition,
    handleSubmit,
}: DeviceSettingsFormProps) => {
    const [availableLocales, setAvailableLocales] = useState<AvailableLocale[]>(
        []
    );

    const form = useForm<z.infer<typeof deviceSettingsSchema>>({
        resolver: zodResolver(deviceSettingsSchema),
        defaultValues: {
            shouldUpdateDevices: competition.shouldUpdateDevices,
            mdns: competition.mdns,
            wsUrl: competition.wsUrl || "",
            wifiSsid: competition.wifiSsid,
            wifiPassword: competition.wifiPassword,
            defaultLocale: competition.defaultLocale,
            hilTesting: competition.hilTesting,
            secureRfid: competition.secureRfid,
        },
    });

    const onSubmit = (values: z.infer<typeof deviceSettingsSchema>) => {
        handleSubmit({
            ...competition,
            ...values,
        });
    };

    useEffect(() => {
        getAvailableLocales().then(setAvailableLocales);
    }, []);

    return (
        <Form {...form}>
            <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-8 py-3"
            >
                <FormField
                    control={form.control}
                    name="hilTesting"
                    render={({ field }) => (
                        <FormItem>
                            <div className="flex items-center gap-2">
                                <FormControl>
                                    <Checkbox
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                    />
                                </FormControl>
                                <FormLabel>HIL Testing</FormLabel>
                            </div>
                            <FormMessage />
                            <FormDescription>
                                If enabled, hil testing will be enabled
                            </FormDescription>
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="secureRfid"
                    render={({ field }) => (
                        <FormItem>
                            <div className="flex items-center gap-2">
                                <FormControl>
                                    <Checkbox
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                    />
                                </FormControl>
                                <FormLabel>Secure RFID</FormLabel>
                            </div>
                            <FormMessage />
                            <FormDescription>
                                Secure RFID cards with token
                            </FormDescription>
                        </FormItem>
                    )}
                />
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
                            .
                        </FormItem>
                    )}
                />
                {form.watch("mdns") === false && (
                    <FormField
                        control={form.control}
                        name="wsUrl"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>micro-connector ws URL</FormLabel>
                                <FormControl>
                                    <Input {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                )}
                <FormField
                    control={form.control}
                    name="defaultLocale"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="flex items-center gap-1">
                                <Globe /> Default locale
                            </FormLabel>
                            <Select
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                            >
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {availableLocales.map((locale) => (
                                        <SelectItem
                                            key={locale.locale}
                                            value={locale.locale}
                                        >
                                            {locale.localeName}
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
                    name="wifiSsid"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="flex items-center gap-1">
                                <Wifi /> WiFi SSID
                            </FormLabel>
                            <FormControl>
                                <Input autoComplete="off" {...field} />
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
                            <FormLabel className="flex items-center gap-1">
                                <KeyRound /> WiFi password
                            </FormLabel>
                            <FormControl>
                                <Input
                                    autoComplete="off"
                                    {...field}
                                    type="password"
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <div className="flex gap-2">
                    <Button
                        type="submit"
                        variant="success"
                        disabled={form.formState.isSubmitting}
                    >
                        Save
                    </Button>
                </div>
            </form>
        </Form>
    );
};

export default DeviceSettingsForm;
