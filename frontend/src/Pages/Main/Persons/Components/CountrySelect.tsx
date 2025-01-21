import { FormControl } from "@/Components/ui/form";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/Components/ui/select";
import { Region } from "@/lib/interfaces";
import regions from "@/lib/regions";

interface CountrySelectProps {
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
}

const CountrySelect = ({
    value,
    onChange,
    disabled = false,
}: CountrySelectProps) => {
    const countries: Region[] = regions.filter(
        (region) =>
            !["_Multiple Continents", "Continent"].includes(region.continentId)
    );

    return (
        <Select
            onValueChange={onChange}
            defaultValue={value}
            disabled={disabled}
        >
            <FormControl>
                <SelectTrigger>
                    <SelectValue placeholder="Select country" />
                </SelectTrigger>
            </FormControl>
            <SelectContent>
                {countries.map((country) => (
                    <SelectItem key={country.iso2} value={country.iso2}>
                        {country.name}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
};

export default CountrySelect;
