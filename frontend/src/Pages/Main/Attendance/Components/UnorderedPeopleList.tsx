import { StaffActivity } from "@/lib/interfaces";

interface PresentPeopleListProps {
    persons: StaffActivity[];
    showDevice?: boolean;
}

const UnorderedPeopleList = ({
    persons,
    showDevice,
}: PresentPeopleListProps) => {
    return (
        <>
            <ul className="list-disc pl-5">
                {persons.map((attendance) => (
                    <li key={attendance.id}>
                        {attendance.person.name}{" "}
                        {showDevice &&
                            attendance.device &&
                            ` - station ${attendance.device.name}`}
                        {!attendance.isAssigned && " (unassigned)"}
                    </li>
                ))}
            </ul>
        </>
    );
};

export default UnorderedPeopleList;
