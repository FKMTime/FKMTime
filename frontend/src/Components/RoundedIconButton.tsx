import { IconButton } from "@chakra-ui/react";
import { ReactElement } from "react";

interface RoundedIconButtonProps {
    icon: ReactElement;
    onClick: () => void;
    title: string;
    ariaLabel: string;
}

const RoundedIconButton = ({
    icon,
    onClick,
    ariaLabel,
    title,
}: RoundedIconButtonProps) => {
    return (
        <IconButton
            aria-label={ariaLabel}
            bg="white"
            color="black"
            rounded="20"
            width="5"
            height="10"
            title={title}
            _hover={{
                background: "white",
                color: "gray.700",
            }}
            onClick={onClick}
        >
            {icon}
        </IconButton>
    );
};

export default RoundedIconButton;
