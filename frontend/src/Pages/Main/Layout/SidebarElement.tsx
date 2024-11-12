import { Box, Button } from "@chakra-ui/react";
import { ReactElement } from "react";
import { useNavigate } from "react-router-dom";

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
                leftIcon={icon}
                colorScheme="teal"
                variant="solid"
                rounded="20"
                width="100%"
                textAlign="center"
                onClick={() => {
                    if (onClick) {
                        onClick();
                    }
                    navigate(link);
                }}
            >
                {name}
            </Button>
        </Box>
    );
};

export default SidebarElement;
