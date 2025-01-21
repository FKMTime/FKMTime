import { ShieldCheck, User } from "lucide-react";

interface RoleIconProps {
    role: string;
}

const RoleIcon = ({ role }: RoleIconProps) => {
    switch (role) {
        case "ADMIN":
            return <ShieldCheck />;
        default:
            return <User />;
    }
};

export default RoleIcon;
