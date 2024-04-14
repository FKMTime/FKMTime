import { Box, Button, Input, InputProps } from "@chakra-ui/react";
import { useState } from "react";
import { IoMdEye, IoMdEyeOff } from "react-icons/io";

const PasswordInput = (props: InputProps) => {
    const [show, setShow] = useState(false);

    return (
        <Box
            display="flex"
            alignItems="center"
            height="100%"
            border="1px"
            borderRadius="md"
        >
            <Input
                type={show ? "text" : "password"}
                placeholder="Enter password"
                border="none"
                _placeholder={{ color: "white" }}
                _hover={{ border: "none" }}
                {...props}
            />
            <Button onClick={() => setShow(!show)}>
                {show ? <IoMdEyeOff /> : <IoMdEye />}
            </Button>
        </Box>
    );
};

export default PasswordInput;
