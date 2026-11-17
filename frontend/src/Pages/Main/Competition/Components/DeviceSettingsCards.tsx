import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { useFormContext } from "react-hook-form";

import SwitchRow from "@/Components/shared/SwitchRow";
import { Button } from "@/Components/ui/button";
import {
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
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { availableLocalesQuery } from "@/lib/competition";
import { BUZZER_VOLUME_MAX, BUZZER_VOLUME_MIN } from "@/lib/constants";
import { CompetitionSettingsInput } from "@/lib/schema/competitionSchema";

import SettingsCard from "./SettingsCard";

const labelClassName = "text-[13px] font-semibold text-muted-foreground";

// Password managers would take the venue Wi-Fi for a login and fill it
const noAutofill = {
    "data-1p-ignore": true,
    "data-lpignore": "true",
    "data-bwignore": true,
    "data-form-type": "other",
};

/** The device settings that sit in the Devices card, after its main switch */
export const DeviceFields = () => {
    const form = useFormContext<CompetitionSettingsInput>();
    const { data: availableLocales = [] } = useLiveQuery(availableLocalesQuery);

    return (
        <>
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
                name="buzzerVolume"
                render={({ field }) => (
                    <FormItem className="space-y-1.5">
                        <FormLabel className={labelClassName}>
                            Device volume: {field.value} / {BUZZER_VOLUME_MAX}
                        </FormLabel>
                        <FormControl>
                            <input
                                type="range"
                                min={BUZZER_VOLUME_MIN}
                                max={BUZZER_VOLUME_MAX}
                                step={1}
                                value={field.value}
                                onChange={(e) =>
                                    field.onChange(e.target.valueAsNumber)
                                }
                                className="w-full accent-primary"
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="defaultLocale"
                render={({ field }) => (
                    <FormItem className="space-y-1.5">
                        <FormLabel className={labelClassName}>
                            Default language
                        </FormLabel>
                        <Select
                            onValueChange={field.onChange}
                            value={field.value}
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
        </>
    );
};

/** How the stations reach the venue Wi-Fi and the server */
export const NetworkCard = () => {
    const form = useFormContext<CompetitionSettingsInput>();
    const [isPasswordShown, setIsPasswordShown] = useState(false);
    const usesMdns = form.watch("mdns");

    return (
        <SettingsCard
            title="Network"
            description="The Wi-Fi the stations join and how they find the server."
        >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField
                    control={form.control}
                    name="wifiSsid"
                    render={({ field }) => (
                        <FormItem className="space-y-1.5">
                            <FormLabel className={labelClassName}>
                                WiFi SSID
                            </FormLabel>
                            <FormControl>
                                <Input
                                    {...field}
                                    value={field.value ?? ""}
                                    autoComplete="off"
                                    {...noAutofill}
                                />
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
                            <FormLabel className={labelClassName}>
                                WiFi password
                            </FormLabel>
                            <div className="relative">
                                <FormControl>
                                    <Input
                                        {...field}
                                        value={field.value ?? ""}
                                        type={
                                            isPasswordShown
                                                ? "text"
                                                : "password"
                                        }
                                        autoComplete="new-password"
                                        className="pr-10"
                                        {...noAutofill}
                                    />
                                </FormControl>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="absolute right-0 top-1/2 size-9 -translate-y-1/2"
                                    aria-label={
                                        isPasswordShown
                                            ? "Hide WiFi password"
                                            : "Show WiFi password"
                                    }
                                    aria-pressed={isPasswordShown}
                                    onClick={() =>
                                        setIsPasswordShown((shown) => !shown)
                                    }
                                >
                                    {isPasswordShown ? <EyeOff /> : <Eye />}
                                </Button>
                            </div>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </div>
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
            {usesMdns === false && (
                <FormField
                    control={form.control}
                    name="wsUrl"
                    render={({ field }) => (
                        <FormItem className="space-y-1.5">
                            <FormLabel className={labelClassName}>
                                micro-connector ws URL
                            </FormLabel>
                            <FormControl>
                                <Input
                                    {...field}
                                    value={field.value ?? ""}
                                    autoComplete="off"
                                    {...noAutofill}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            )}
        </SettingsCard>
    );
};

/** Settings only for testing the stations, closed by default */
export const AdvancedCard = () => {
    const form = useFormContext<CompetitionSettingsInput>();
    return (
        <SettingsCard
            title="Advanced"
            description="For testing the stations; leave these alone at a competition."
            collapsible
        >
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
        </SettingsCard>
    );
};
