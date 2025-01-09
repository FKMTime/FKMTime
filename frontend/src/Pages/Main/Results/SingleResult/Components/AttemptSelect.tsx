import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/Components//ui/select";
import { Attempt } from "@/lib/interfaces";

interface AttemptSelectProps {
    value: string;
    attempts: Attempt[];
    onChange: (value: string) => void;
    disabled?: boolean;
}

const AttemptSelect = ({
    value,
    attempts,
    onChange,
    disabled = false,
}: AttemptSelectProps) => {
    return (
        <Select
            onValueChange={onChange}
            defaultValue={value}
            disabled={disabled}
        >
            <SelectTrigger>
                <SelectValue placeholder="Select device" />
            </SelectTrigger>
            <SelectContent>
                {attempts.map((attempt) => (
                    <SelectItem key={attempt.id} value={attempt.id}>
                        {attempt.attemptNumber}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
};

export default AttemptSelect;
