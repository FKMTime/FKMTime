import { Button } from "./ui/button";

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
        <Button
            size="icon"
            variant="ghost"
            aria-label={ariaLabel}
            title={title}
            onClick={onClick}
        >
            {icon}
        </Button>
    );
};

export default SmallIconButton;
