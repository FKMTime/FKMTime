import { Zap, ZapOff } from "lucide-react";

import { Switch } from "@/Components/ui/switch";
import { cn } from "@/lib/utils";

interface AutoChangeSwitchProps {
    isOn: boolean;
    disabled: boolean;
    onChange: (value: boolean) => void;
}

/** The competition-wide setting, with what it means right now */
const AutoChangeSwitch = ({
    isOn,
    disabled,
    onChange,
}: AutoChangeSwitchProps) => (
    <label className="flex cursor-pointer items-center gap-3 rounded-xl border bg-card px-3 py-2 md:max-w-md">
        <span
            className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-lg [&>svg]:size-4",
                isOn
                    ? "bg-primary-soft text-primary"
                    : "bg-secondary text-muted-foreground"
            )}
        >
            {isOn ? <Zap /> : <ZapOff />}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-sm font-semibold">
                Automatic group change {isOn ? "on" : "off"}
            </span>
            <span className="text-pretty text-xs text-muted-foreground">
                {isOn
                    ? "Rooms move on a few seconds after a group's last result."
                    : "Rooms wait until you start their next group."}
            </span>
        </span>
        <Switch
            checked={isOn}
            disabled={disabled}
            onCheckedChange={onChange}
            aria-label="Automatic group change"
        />
    </label>
);

export default AutoChangeSwitch;
