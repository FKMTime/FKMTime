import { useId } from "react";

import { Switch } from "@/Components/ui/switch";

interface SwitchRowProps {
    label: string;
    description?: string;
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    disabled?: boolean;
}

/**
 * A setting with a switch: the switch leads on desktop and trails on mobile,
 * where rows stack with dividers.
 */
const SwitchRow = ({
    label,
    description,
    checked,
    onCheckedChange,
    disabled,
}: SwitchRowProps) => {
    const id = useId();
    return (
        <div className="flex items-center gap-3.5 border-b py-3 last:border-b-0 md:items-start md:gap-3 md:border-b-0 md:py-1.5">
            <Switch
                id={id}
                checked={checked}
                onCheckedChange={onCheckedChange}
                disabled={disabled}
                aria-describedby={description ? `${id}-description` : undefined}
                className="order-last md:order-first md:mt-px"
            />
            <label
                htmlFor={id}
                className="flex min-w-0 flex-1 cursor-pointer flex-col gap-0.5"
            >
                <span className="text-[15px] font-semibold md:text-sm">
                    {label}
                </span>
                {description && (
                    <span
                        id={`${id}-description`}
                        className="text-[13px] text-muted-foreground"
                    >
                        {description}
                    </span>
                )}
            </label>
        </div>
    );
};

export default SwitchRow;
