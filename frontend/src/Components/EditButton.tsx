import { MdEdit } from "react-icons/md";

import SmallIconButton from "./SmallIconButton";

interface EditButtonProps {
    onClick: () => void;
    title?: string;
}

const EditButton = ({ onClick, title }: EditButtonProps) => {
    return (
        <SmallIconButton
            icon={<MdEdit />}
            title={title || "Edit"}
            onClick={onClick}
        />
    );
};

export default EditButton;
