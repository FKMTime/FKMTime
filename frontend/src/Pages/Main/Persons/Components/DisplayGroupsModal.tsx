import { Modal } from "@/Components/Modal";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/Components/ui/table";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { activityCodeToName, prettyActivityName } from "@/lib/activities";
import {
    personStaffActivitiesQuery,
    prettyStaffActivityStatus,
} from "@/lib/attendance";
import { Person, StaffActivity } from "@/lib/interfaces";

interface DisplayGroupsModalProps {
    isOpen: boolean;
    onClose: () => void;
    person: Person;
}

const DisplayGroupsModal = ({
    isOpen,
    onClose,
    person,
}: DisplayGroupsModalProps) => {
    const { data } = useLiveQuery(personStaffActivitiesQuery(person.id), {
        enabled: !!person.registrantId && isOpen,
    });
    const staffActivity: StaffActivity[] = data ?? [];

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Groups">
            <div className="overflow-y-auto h-96 w-fit">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Group</TableHead>
                            <TableHead>Activity</TableHead>
                            <TableHead>Was present</TableHead>
                            <TableHead>Is assigned</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {staffActivity.map((activity) => (
                            <TableRow key={activity.id}>
                                <TableCell>
                                    {activityCodeToName(activity.groupId)}
                                </TableCell>
                                <TableCell>
                                    {prettyActivityName(activity.role)}
                                </TableCell>
                                <TableCell>
                                    {prettyStaffActivityStatus(activity.status)}
                                </TableCell>
                                <TableCell>
                                    {activity.isAssigned ? "Yes" : "No"}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </Modal>
    );
};

export default DisplayGroupsModal;
