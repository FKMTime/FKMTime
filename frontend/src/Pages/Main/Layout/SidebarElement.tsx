import { Box } from "@chakra-ui/react";
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
        <Box width="100%">
            <Button
                variant="solid"
                rounded="lg"
                width="100%"
                textAlign="center"
                onClick={() => {
                    if (onClick) {
                        onClick();
                    }
                    navigate(link);
                }}
            >
                <>{icon}</>
                {name}
            </Button>
        </Box>
    );
};

export default SidebarElement;
