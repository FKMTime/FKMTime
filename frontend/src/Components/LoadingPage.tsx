import { Box, Spinner } from "@chakra-ui/react";

const LoadingPage = () => {
    return (
        <Box
            display="flex"
            justifyContent="center"
            alignItems="center"
            height="100vh"
        >
            <Spinner size="xl" />
        </Box>
    );
};

export default LoadingPage;
