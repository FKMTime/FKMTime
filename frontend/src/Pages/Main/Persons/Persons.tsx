import { useAtomValue } from "jotai";
import { UserPlus } from "lucide-react";
import { useEffect, useState } from "react";

import LoadingPage from "@/Components/LoadingPage";
import Pagination from "@/Components/Pagination";
import EmptyState from "@/Components/shared/EmptyState";
import SearchInput from "@/Components/shared/SearchInput";
import ToggleChip from "@/Components/shared/ToggleChip";
import { Button } from "@/Components/ui/button";
import { Input } from "@/Components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/Components/ui/select";
import { competitionAtom } from "@/lib/atoms";
import { Person } from "@/lib/interfaces";
import { isOrganizerOrDelegate } from "@/lib/permissions";
import { getPersons } from "@/lib/persons";
import { calculateTotalPages } from "@/lib/utils";

import AddPersonModal from "./Components/AddPersonModal";
import AssignCardModal from "./Components/AssignCardModal";
import DisplayGroupsModal from "./Components/DisplayGroupsModal";
import DisplayWarningsModal from "./Components/DisplayWarningsModal";
import IssueWarningModal from "./Components/IssueWarningModal";
import PersonsList, { PersonDialog } from "./Components/PersonsList";
import PersonsTabs from "./Components/PersonsTabs";

const SEARCH_DEBOUNCE_MS = 250;

interface Filters {
    search: string;
    registrantId: string;
    cardId: string;
    onlyNewcomers: boolean;
    onlyNotCheckedIn: boolean;
}

const Persons = () => {
    const competition = useAtomValue(competitionAtom);
    const [filters, setFilters] = useState<Filters>({
        search: "",
        registrantId: "",
        cardId: "",
        onlyNewcomers: false,
        onlyNotCheckedIn: false,
    });
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [persons, setPersons] = useState<Person[] | null>(null);
    const [count, setCount] = useState(0);
    const [refreshKey, setRefreshKey] = useState(0);
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [dialog, setDialog] = useState<{
        type: PersonDialog;
        person: Person;
    } | null>(null);

    const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
        setFilters((current) => ({ ...current, [key]: value }));
        setPage(1);
    };

    useEffect(() => {
        let isCancelled = false;
        const timeout = setTimeout(async () => {
            const registrantId = parseInt(filters.registrantId);
            const response = await getPersons(
                page,
                pageSize,
                filters.search || undefined,
                Number.isNaN(registrantId) ? undefined : registrantId,
                undefined,
                filters.cardId || undefined,
                filters.onlyNewcomers,
                filters.onlyNotCheckedIn
            );
            if (isCancelled) return;
            setPersons(response.data);
            setCount(response.count);
        }, SEARCH_DEBOUNCE_MS);
        return () => {
            isCancelled = true;
            clearTimeout(timeout);
        };
    }, [filters, page, pageSize, refreshKey]);

    if (!competition || !persons) return <LoadingPage />;

    const refresh = () => setRefreshKey((key) => key + 1);
    const closeDialog = () => {
        setDialog(null);
        refresh();
    };
    const totalPages = calculateTotalPages(count, pageSize);

    return (
        <div className="flex flex-col gap-4">
            <PersonsTabs value="all" refreshKey={refreshKey} />

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <div className="flex flex-1 flex-wrap items-center gap-2">
                    <SearchInput
                        value={filters.search}
                        onChange={(e) => setFilter("search", e.target.value)}
                        placeholder="Search by name or WCA ID"
                        label="Search persons"
                        className="md:max-w-xs"
                    />
                    <Input
                        value={filters.registrantId}
                        onChange={(e) =>
                            setFilter("registrantId", e.target.value)
                        }
                        inputMode="numeric"
                        placeholder="ID"
                        aria-label="Registrant ID"
                        className="w-20"
                    />
                    {competition.useFkmTimeDevices && (
                        <Input
                            value={filters.cardId}
                            onChange={(e) =>
                                setFilter("cardId", e.target.value)
                            }
                            placeholder="Card"
                            aria-label="Card ID"
                            className="w-28"
                        />
                    )}
                    <ToggleChip
                        pressed={filters.onlyNewcomers}
                        onPressedChange={(value) =>
                            setFilter("onlyNewcomers", value)
                        }
                    >
                        Newcomers
                    </ToggleChip>
                    <ToggleChip
                        pressed={filters.onlyNotCheckedIn}
                        onPressedChange={(value) =>
                            setFilter("onlyNotCheckedIn", value)
                        }
                    >
                        Not checked in
                    </ToggleChip>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">
                        {count} {count === 1 ? "person" : "persons"}
                    </span>
                    {isOrganizerOrDelegate() &&
                        competition.useFkmTimeDevices && (
                            <Button
                                onClick={() => setIsAddOpen(true)}
                                className="ml-auto"
                            >
                                <UserPlus />
                                Add person
                            </Button>
                        )}
                </div>
            </div>

            {persons.length === 0 ? (
                <EmptyState>No persons found.</EmptyState>
            ) : (
                <PersonsList
                    persons={persons}
                    competition={competition}
                    onOpenDialog={(type, person) => setDialog({ type, person })}
                />
            )}

            {count > 10 && (
                <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
                    <Select
                        value={pageSize.toString()}
                        onValueChange={(value) => {
                            setPageSize(parseInt(value));
                            setPage(1);
                        }}
                    >
                        <SelectTrigger
                            className="w-36"
                            aria-label="Persons per page"
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {[10, 25, 50].map((size) => (
                                <SelectItem key={size} value={size.toString()}>
                                    {size} per page
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {totalPages > 1 && (
                        <Pagination
                            page={page}
                            totalPages={totalPages}
                            handlePageChange={setPage}
                        />
                    )}
                </div>
            )}

            {isAddOpen && (
                <AddPersonModal
                    isOpen
                    onClose={() => {
                        setIsAddOpen(false);
                        refresh();
                    }}
                />
            )}
            {dialog?.type === "card" && (
                <AssignCardModal
                    isOpen
                    onClose={closeDialog}
                    person={dialog.person}
                />
            )}
            {dialog?.type === "groups" && (
                <DisplayGroupsModal
                    isOpen
                    onClose={closeDialog}
                    person={dialog.person}
                />
            )}
            {dialog?.type === "warnings" && (
                <DisplayWarningsModal
                    isOpen
                    onClose={closeDialog}
                    person={dialog.person}
                />
            )}
            {dialog?.type === "issueWarning" && (
                <IssueWarningModal
                    isOpen
                    onClose={closeDialog}
                    person={dialog.person}
                />
            )}
        </div>
    );
};

export default Persons;
