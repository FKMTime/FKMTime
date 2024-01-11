import { Button } from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";

interface SidebarElementProps {
    name: string;
    icon: React.ReactElement;
    link: string;
}

const SidebarElement: React.FC<SidebarElementProps> = ({ name, icon, link }): JSX.Element => {

    const navigate = useNavigate();
    return (
        <Button leftIcon={icon} colorScheme='teal' variant='solid' rounded="20" width="100%" textAlign="center" onClick={() => navigate(link)}>
            {name}
        </Button>
    );
};

export default SidebarElement;
