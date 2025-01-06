import { ReactElement } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/Components/ui/button";

interface SidebarElementProps {
    name: string;
    icon: ReactElement;
    link: string;
    onClick?: () => void;
}

const SidebarElement = ({ name, icon, link, onClick }: SidebarElementProps) => {
    const navigate = useNavigate();
    return (
        <div className="w-full">
            <Button
                className="w-full text-center rounded-full"
                onClick={() => {
                    if (onClick) {
                        onClick();
                    }
                    navigate(link);
                }}
            >
                {icon}
                {name}
            </Button>
        </div>
    );
};

export default SidebarElement;
