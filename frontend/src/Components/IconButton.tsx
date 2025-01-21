import { ButtonHTMLAttributes, ReactNode } from "react";

import { Button } from "./ui/button";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    icon: ReactNode;
    filled?: boolean;
}

const IconButton = ({ icon, filled, ...props }: IconButtonProps) => {
    return (
        <Button {...props} variant={filled ? "default" : "ghost"}>
            {icon}
        </Button>
    );
};

export default IconButton;
