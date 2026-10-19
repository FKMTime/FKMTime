import { LucideIcon } from "lucide-react";
import { useState } from "react";

import InlineError from "@/Components/shared/InlineError";
import { Input } from "@/Components/ui/input";

interface ScanPromptProps {
    icon: LucideIcon;
    title: string;
    description: string;
    error: string;
    /** Called with the trimmed card number when the scanner sends Enter */
    onScan: (cardId: string) => void;
    onChange: () => void;
}

/** Big empty state with a card number field the scanner types into */
const ScanPrompt = ({
    icon: Icon,
    title,
    description,
    error,
    onScan,
    onChange,
}: ScanPromptProps) => {
    const [value, setValue] = useState("");

    return (
        <div className="flex flex-col items-center gap-4 rounded-2xl border bg-card px-6 py-10 text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-primary-soft text-primary">
                <Icon className="size-7" />
            </span>
            <div className="flex flex-col gap-1">
                <h2 className="text-xl font-bold">{title}</h2>
                <p className="text-muted-foreground">{description}</p>
            </div>
            <Input
                value={value}
                onChange={(event) => {
                    setValue(event.target.value);
                    onChange();
                }}
                onKeyDown={(event) => {
                    if (event.key !== "Enter") return;
                    const cardId = value.trim();
                    setValue("");
                    if (cardId) onScan(cardId);
                }}
                placeholder="Card number"
                aria-label={title}
                autoFocus
                autoComplete="off"
                className="h-12 max-w-[320px] text-center text-base md:h-12 md:text-base"
            />
            <InlineError className="w-full max-w-[320px] text-left">
                {error}
            </InlineError>
        </div>
    );
};

export default ScanPrompt;
