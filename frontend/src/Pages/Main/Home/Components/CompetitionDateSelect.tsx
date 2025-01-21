import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/Components/ui/select";

interface CompetitionDateSelectProps {
    selectedDate: Date;
    onChange: (date: Date) => void;
    possibleDates: Date[];
}

const CompetitionDateSelect = ({
    selectedDate,
    onChange,
    possibleDates,
}: CompetitionDateSelectProps) => {
    return (
        <Select
            value={selectedDate.toISOString()}
            onValueChange={(value) => onChange(new Date(value))}
        >
            <SelectTrigger className="w-fit">
                <SelectValue placeholder="Select a date" />
            </SelectTrigger>
            <SelectContent>
                {possibleDates.map((date) => (
                    <SelectItem
                        key={date.toISOString()}
                        value={date.toISOString()}
                    >
                        {date.toISOString().split("T")[0]}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
};

export default CompetitionDateSelect;
