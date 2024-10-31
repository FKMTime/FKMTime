import { Box } from "@chakra-ui/react";

const ScrambleSets = () => {
    const handleClick = () => {
        //TODO: Implement
    };
    return (
        <Box display="flex" flexDirection="column" gap="3">
            <input type="file" onChange={handleClick} />
        </Box>
    );
};

export default ScrambleSets;
