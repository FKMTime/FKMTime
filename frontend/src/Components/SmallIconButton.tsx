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
            icon={icon}
            aria-label={ariaLabel}
            bg="none"
            color="white"
            _hover={{
                background: "none",
                color: "gray.400",
            }}
            title={title}
            onClick={onClick}
        />
    );
};

export default SmallIconButton;
