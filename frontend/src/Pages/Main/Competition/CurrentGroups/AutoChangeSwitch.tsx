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
    <label className="flex cursor-pointer items-center gap-3 rounded-xl border bg-card px-4 py-3">
        <span
            className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-lg [&>svg]:size-[18px]",
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
            <span className="text-pretty text-[13px] text-muted-foreground">
                {isOn
                    ? "A room moves to its next group a few seconds after the group's last result."
                    : "Rooms stay on their groups until you start the next one here."}
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
