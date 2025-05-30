import { Input } from "@/Components/ui/input";
import { Label } from "@/Components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/Components/ui/select";
import { Switch } from "@/Components/ui/switch";
import { Competition } from "@/lib/interfaces";

interface PersonsFiltersProps {
    searchedId: string;
    handleSearchId: (e: React.ChangeEvent<HTMLInputElement>) => void;
    searchedCardId: string;
    handleSearchCardId: (e: React.ChangeEvent<HTMLInputElement>) => void;
    search: string;
    handleSearch: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onlyNewcomers: boolean;
    handleOnlyNewcomers: () => void;
    onlyNotCheckedIn: boolean;
    handleOnlyNotCheckedIn: () => void;
    totalPages: number;
    pageSize: number;
    handlePageSizeChange: (newValue: string) => void;
    competition: Competition;
}

const PersonsFilters = ({
    searchedId,
    handleSearchId,
    searchedCardId,
    handleSearchCardId,
    search,
    handleSearch,
    onlyNewcomers,
    handleOnlyNewcomers,
    onlyNotCheckedIn,
    handleOnlyNotCheckedIn,
    totalPages,
    pageSize,
    handlePageSizeChange,
    competition,
}: PersonsFiltersProps) => {
    return (
        <div className="flex flex-col md:flex-row gap-3">
            {totalPages !== 0 && (
                <div className="w-24">
                    <Select
                        value={pageSize.toString()}
                        onValueChange={handlePageSizeChange}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Page size" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="10">10</SelectItem>
                            <SelectItem value="25">25</SelectItem>
                            <SelectItem value="50">50</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            )}
            <Input
                placeholder="ID"
                value={searchedId}
                onChange={handleSearchId}
                className="w-full md:w-16"
            />
            {competition.useFkmTimeDevices && (
                <Input
                    placeholder="Card"
                    value={searchedCardId}
                    onChange={handleSearchCardId}
                    className="w-full md:w-32"
                />
            )}
            <Input
                placeholder="Search"
                value={search}
                onChange={handleSearch}
                className="w-full md:w-64"
            />
            <div className="flex items-center space-x-2">
                <Switch
                    id="onlyNewcomers"
                    checked={onlyNewcomers}
                    onCheckedChange={handleOnlyNewcomers}
                />
                <Label htmlFor="onlyNewcomers">Newcomers</Label>
            </div>
            <div className="flex items-center space-x-2">
                <Switch
                    id="onlyNotCheckedIn"
                    checked={onlyNotCheckedIn}
                    onCheckedChange={handleOnlyNotCheckedIn}
                />
                <Label htmlFor="onlyNotCheckedIn">Not checked in</Label>
            </div>
        </div>
    );
};

export default PersonsFilters;
