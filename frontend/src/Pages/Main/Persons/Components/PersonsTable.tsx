import {
    Table,
    TableBody,
    TableHead,
    TableHeader,
    TableRow,
} from "@/Components/ui/table";
import { Competition, Person } from "@/lib/interfaces";

import PersonRow from "./PersonRow";

interface PersonsTableProps {
    persons: Person[];
    competition?: Competition;
    handleCloseEditModal: () => void;
}

const PersonsTable = ({
    persons,
    competition,
    handleCloseEditModal,
}: PersonsTableProps) => {
    if (!persons || persons.length === 0) {
        return (
            <div className="text-center">
                <h3 className="text-lg">No persons found</h3>
            </div>
        );
    }
    return (
        <>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Registrant ID</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>WCA ID</TableHead>
                        <TableHead>Representing</TableHead>
                        <TableHead>Gender</TableHead>
                        <TableHead>Events</TableHead>
                        {competition?.useFkmTimeDevices && (
                            <TableHead>Card assigned</TableHead>
                        )}
                        <TableHead>Checked in</TableHead>
                        {competition?.useFkmTimeDevices && (
                            <TableHead>Can compete</TableHead>
                        )}
                        <TableHead>Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {competition &&
                        persons.map((person: Person) => (
                            <PersonRow
                                competition={competition}
                                key={person.id}
                                person={person}
                                handleCloseEditModal={handleCloseEditModal}
                            />
                        ))}
                </TableBody>
            </Table>
        </>
    );
};

export default PersonsTable;
