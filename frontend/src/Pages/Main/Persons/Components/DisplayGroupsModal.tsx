import { useEffect, useState } from "react";

import { Modal } from "@/Components/Modal";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/Components/ui/table";
import { activityCodeToName, prettyActivityName } from "@/lib/activities";
import {
    getStaffActivitiesByPersonId,
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
    const [staffActivity, setStaffActivity] = useState<StaffActivity[]>([]);

    useEffect(() => {
        if (person.registrantId && isOpen) {
            getStaffActivitiesByPersonId(person.id).then((data) => {
                setStaffActivity(data);
            });
        }
    }, [isOpen, person.id, person.registrantId]);

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
