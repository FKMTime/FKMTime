import { FormControl } from "@/Components/ui/form";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/Components/ui/select";
import { POSSIBLE_GENDERS } from "@/lib/constants";
import { prettyGender } from "@/lib/utils";

interface GenderSelectProps {
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
}

const GenderSelect = ({
    value,
    onChange,
    disabled = false,
}: GenderSelectProps) => {
    return (
        <Select
            onValueChange={onChange}
            defaultValue={value}
            disabled={disabled}
        >
            <FormControl>
                <SelectTrigger>
                    <SelectValue placeholder="Select gender" />
                </SelectTrigger>
            </FormControl>
            <SelectContent>
                {POSSIBLE_GENDERS.map((gender) => (
                    <SelectItem key={gender} value={gender}>
                        {prettyGender(gender)}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
};

export default GenderSelect;
