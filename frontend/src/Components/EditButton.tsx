import { Pencil } from "lucide-react";

import SmallIconButton from "./SmallIconButton";

interface EditButtonProps {
    onClick: () => void;
    title?: string;
}

const EditButton = ({ onClick, title }: EditButtonProps) => {
    return (
        <SmallIconButton
            icon={<Pencil />}
            title={title || "Edit"}
            onClick={onClick}
        />
    );
};

export default EditButton;
