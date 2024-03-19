import {Box, Button, Heading} from "@chakra-ui/react";
import {useNavigate} from "react-router-dom";

const NotFound = () => {
    const navigate = useNavigate();

    return (
        <Box display="flex" alignItems="center" justifyContent="center" height="100%" flexDirection="column" gap="5" mt="5">
            <Heading size="lg" color="white">Error 404</Heading>
            <Heading color="red.500">Page not found</Heading>
            <Button colorScheme="blue" mt="5" onClick={() => navigate("/")}>
                Home
            </Button>
        </Box>
    );
};

export default NotFound;