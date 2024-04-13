import {
    Alert,
    AlertIcon,
    AlertTitle,
    Box,
    Button,
    Heading,
} from "@chakra-ui/react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import wcaLogo from "@/assets/wca.svg";
import LoadingPage from "@/Components/LoadingPage.tsx";
import { loginWithWca } from "@/logic/auth.ts";

const WCALogin = () => {
    const searchParams = new URLSearchParams(window.location.search);
    const code = searchParams.get("code");
    const navigate = useNavigate();
    const [error, setError] = useState<string | null>(null);

    const handleLogin = useCallback(async () => {
        if (code) {
            const res = await loginWithWca(code, window.location.href);
            if (res.status >= 400) {
                setError(res.data.message);
            } else {
                navigate("/");
            }
        }
    }, [code, navigate]);

    useEffect(() => {
        handleLogin();
    }, [code, handleLogin, navigate]);

    if (!error) {
        return <LoadingPage />;
    }
    return (
        <Box
            display="flex"
            flexDirection="column"
            gap="5"
            alignItems="center"
            mt={2}
        >
            <Box
                display="flex"
                width="full"
                alignItems="center"
                justifyContent="center"
                gap="2"
            >
                <Heading size="xl">Login with</Heading>
                <img src={wcaLogo} width="30" alt="WCA" />
            </Box>
            {error && (
                <>
                    <Alert
                        status="error"
                        color="black"
                        width={{ base: "90%", md: "50%" }}
                    >
                        <AlertIcon />
                        <AlertTitle>{error}</AlertTitle>
                    </Alert>
                    <Button
                        colorScheme="blue"
                        onClick={() => navigate("/auth/login")}
                    >
                        Back to login
                    </Button>
                </>
            )}
        </Box>
    );
};

export default WCALogin;
