import { IconButton, IconButtonProps } from "@chakra-ui/react";
import { MdAdd } from "react-icons/md";

const PlusButton = ({ ...props }: IconButtonProps) => {
    return (
        <IconButton
            {...props}
            aria-label="Add"
            bg="white"
            color="black"
            rounded="20"
            width="5"
            height="10"
            _hover={{
                background: "white",
                color: "gray.700",
            }}
        >
            <MdAdd />
        </IconButton>
    );
};

export default PlusButton;
