import { IconButton } from "@chakra-ui/react";

interface SmallIconButtonProps {
    ariaLabel: string;
    icon: React.ReactElement;
    onClick: () => void;
    title: string;
}

const SmallIconButton = ({
    ariaLabel,
    icon,
    onClick,
    title,
}: SmallIconButtonProps) => {
    return (
        <IconButton
            aria-label={ariaLabel}
            bg="none"
            color="white"
            _hover={{
                background: "none",
                color: "gray.400",
            }}
            title={title}
            onClick={onClick}
        >
            {icon}
        </IconButton>
    );
};

export default SmallIconButton;
