import { ButtonHTMLAttributes, ReactNode } from "react";

import { Button } from "./ui/button";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    icon: ReactNode;
}

const IconButton = ({ icon, ...props }: IconButtonProps) => {
    return (
        <Button {...props} variant="ghost">
            {icon}
        </Button>
    );
};

export default IconButton;