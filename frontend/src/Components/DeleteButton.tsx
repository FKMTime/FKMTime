import { MdDelete } from "react-icons/md";

import SmallIconButton from "./SmallIconButton";

interface DeleteButtonProps {
    onClick: () => void;
    title?: string;
}

const DeleteButton = ({ onClick, title }: DeleteButtonProps) => {
    return (
        <SmallIconButton
            icon={<MdDelete />}
            title={title || "Delete"}
            onClick={onClick}
        />
    );
};

export default DeleteButton;
