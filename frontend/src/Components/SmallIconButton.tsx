import { Button } from "./ui/button";

interface SmallIconButtonProps {
    icon: React.ReactElement;
    onClick: () => void;
    title: string;
}

const SmallIconButton = ({ icon, onClick, title }: SmallIconButtonProps) => {
    return (
        <Button size="icon" variant="ghost" title={title} onClick={onClick}>
            {icon}
        </Button>
    );
};

export default SmallIconButton;
