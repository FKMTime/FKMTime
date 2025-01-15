import { Trash2 } from "lucide-react";

import SmallIconButton from "./SmallIconButton";

interface DeleteButtonProps {
    onClick: () => void;
    title?: string;
}

const DeleteButton = ({ onClick, title }: DeleteButtonProps) => {
    return (
        <SmallIconButton
            icon={<Trash2 />}
            title={title || "Delete"}
            onClick={onClick}
        />
    );
};

export default DeleteButton;
