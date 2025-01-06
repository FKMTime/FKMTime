import { MdAdd } from "react-icons/md";

import { Button } from "./ui/button";

interface PlusButtonProps extends React.ComponentProps<typeof Button> {}
const PlusButton = ({ ...props }: PlusButtonProps) => {
    return (
        <Button size="icon" {...props}>
            <MdAdd />
        </Button>
    );
};

export default PlusButton;
