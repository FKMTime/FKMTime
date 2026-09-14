import { Plus } from "lucide-react";

import { cn } from "@/lib/utils";

import { Button } from "./ui/button";

interface PlusButtonProps extends React.ComponentProps<typeof Button> {}
const PlusButton = ({ className, ...props }: PlusButtonProps) => {
    return (
        <Button size="icon" className={cn("p-2", className)} {...props}>
            <Plus />
        </Button>
    );
};

export default PlusButton;
