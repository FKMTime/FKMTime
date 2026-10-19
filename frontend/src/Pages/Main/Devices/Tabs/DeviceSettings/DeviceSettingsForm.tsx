import { zodResolver } from "@hookform/resolvers/zod";
import { Save } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import SwitchRow from "@/Components/shared/SwitchRow";
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
            soundEnabled: competition.soundEnabled,
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
                className="flex max-w-[560px] flex-col gap-4 md:gap-5"
            >
                <div className="flex flex-col md:gap-2">
                    <FormField
                        control={form.control}
                        name="hilTesting"
                        render={({ field }) => (
                            <SwitchRow
                                label="HIL Testing"
                                description="If enabled, hil testing will be enabled"
                                checked={field.value}
                                onCheckedChange={field.onChange}
                            />
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="secureRfid"
                        render={({ field }) => (
                            <SwitchRow
                                label="Secure RFID"
                                description="Secure RFID cards with token"
                                checked={field.value}
                                onCheckedChange={field.onChange}
                            />
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="shouldUpdateDevices"
                        render={({ field }) => (
                            <SwitchRow
                                label="Update devices"
                                description="Turn it off if competition is in progress"
                                checked={field.value}
                                onCheckedChange={field.onChange}
                            />
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="soundEnabled"
                        render={({ field }) => (
                            <SwitchRow
                                label="Enable sound"
                                description="Enable sound for devices (e.g. beep after scanning the card)"
                                checked={field.value}
                                onCheckedChange={field.onChange}
                            />
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="mdns"
                        render={({ field }) => (
                            <SwitchRow
                                label="Auto server discovery"
                                description="Use MDNS to search for a server in local network"
                                checked={field.value}
                                onCheckedChange={field.onChange}
                            />
                        )}
                    />
                </div>
                {form.watch("mdns") === false && (
                    <FormField
                        control={form.control}
                        name="wsUrl"
                        render={({ field }) => (
                            <FormItem className="space-y-1.5">
                                <FormLabel className="text-[13px] font-semibold text-muted-foreground">
                                    micro-connector ws URL
                                </FormLabel>
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
                        <FormItem className="space-y-1.5">
                            <FormLabel className="text-[13px] font-semibold text-muted-foreground">
                                Default language
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
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <FormField
                        control={form.control}
                        name="wifiSsid"
                        render={({ field }) => (
                            <FormItem className="space-y-1.5">
                                <FormLabel className="text-[13px] font-semibold text-muted-foreground">
                                    WiFi SSID
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
                            <FormItem className="space-y-1.5">
                                <FormLabel className="text-[13px] font-semibold text-muted-foreground">
                                    WiFi password
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
                </div>
                <Button
                    type="submit"
                    className="w-full md:w-fit"
                    disabled={form.formState.isSubmitting}
                >
                    <Save />
                    Save
                </Button>
            </form>
        </Form>
    );
};

export default DeviceSettingsForm;
