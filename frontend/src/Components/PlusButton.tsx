import { Plus } from "lucide-react";

import { Button } from "./ui/button";

interface PlusButtonProps extends React.ComponentProps<typeof Button> {}
const PlusButton = ({ ...props }: PlusButtonProps) => {
    return (
        <Button size="icon" {...props}>
            <Plus />
        </Button>
    );
};

export default PlusButton;
