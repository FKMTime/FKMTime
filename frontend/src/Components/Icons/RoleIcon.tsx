import { FaBan } from "react-icons/fa";
import { MdAdminPanelSettings, MdPerson } from "react-icons/md";

interface RoleIconProps {
    role: string;
}

const RoleIcon = ({ role }: RoleIconProps) => {
    switch (role) {
        case "ADMIN":
            return <MdAdminPanelSettings />;
        case "DELEGATE":
            return <FaBan />;
        default:
            return <MdPerson />;
    }
};

export default RoleIcon;
