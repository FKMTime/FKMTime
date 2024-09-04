import { Box } from "@chakra-ui/react";

import logo from "@/assets/logo.svg";

import LoginForm from "../Components/LoginForm";

interface MobileLoginProps {
    handleSubmit: (username: string, password: string) => void;
    handleWcaLogin: () => void;
}

const MobileLogin = ({ handleSubmit, handleWcaLogin }: MobileLoginProps) => {
    return (
        <Box
            display="flex"
            justifyContent="center"
            alignItems="center"
            height="100vh"
            color="white"
            flexDirection="column"
            backgroundColor="gray.800"
            p={10}
            gap={10}
        >
            <img src={logo} width="400" alt="logo" />
            <LoginForm
                handleLogin={handleSubmit}
                handleWcaLogin={handleWcaLogin}
            />
        </Box>
    );
};

export default MobileLogin;
