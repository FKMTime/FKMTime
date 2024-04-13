import { MdAdminPanelSettings, MdPerson } from "react-icons/md";

interface RoleIconProps {
    role: string;
}

const RoleIcon = ({ role }: RoleIconProps) => {
    switch (role) {
        case "ADMIN":
            return <MdAdminPanelSettings />;
        default:
            return <MdPerson />;
    }
};

export default RoleIcon;
