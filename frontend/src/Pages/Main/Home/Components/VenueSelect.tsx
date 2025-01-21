import { Venue } from "@wca/helpers";

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/Components/ui/select";

interface VenueSelectProps {
    venues: Venue[];
    selectedVenueId: string;
    onChange: (id: string) => void;
}

const VenueSelect = ({
    venues,
    selectedVenueId,
    onChange,
}: VenueSelectProps) => {
    return (
        <Select
            value={selectedVenueId}
            onValueChange={(value) => onChange(value)}
        >
            <SelectTrigger className="w-fit">
                <SelectValue placeholder="Select a venue" />
            </SelectTrigger>
            <SelectContent>
                {venues.map((venue) => (
                    <SelectItem key={venue.id} value={venue.id.toString()}>
                        {venue.name}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
};

export default VenueSelect;
