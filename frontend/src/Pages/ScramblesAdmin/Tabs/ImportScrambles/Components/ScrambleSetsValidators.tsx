import {
    Alert,
    AlertIcon,
    AlertTitle,
    Box,
    ListItem,
    Text,
    UnorderedList,
} from "@chakra-ui/react";

interface ScrambleSetsValidatorsProps {
    warnings: string[];
    errors: string[];
}

const ScrambleSetsValidators = ({
    warnings: warningsList,
    errors: errorsList,
}: ScrambleSetsValidatorsProps) => {
    return (
        <>
            {errorsList.length > 0 && (
                <Alert status="error" borderRadius="md" color="black">
                    <Box>
                        <AlertTitle display="flex" gap={2}>
                            <AlertIcon m={0} />
                            <Text>Errors detected during import</Text>
                        </AlertTitle>
                        <UnorderedList>
                            {errorsList.map((error, i) => (
                                <ListItem key={i}>{error}</ListItem>
                            ))}
                        </UnorderedList>
                    </Box>
                </Alert>
            )}
            {warningsList.length > 0 && (
                <Alert status="warning" borderRadius="md" color="black">
                    <Box>
                        <AlertTitle display="flex" gap={2}>
                            <AlertIcon m={0} />
                            <Text>Warnings detected during import</Text>
                        </AlertTitle>
                        <UnorderedList>
                            {warningsList.map((warning, i) => (
                                <ListItem key={i}>{warning}</ListItem>
                            ))}
                        </UnorderedList>
                    </Box>
                </Alert>
            )}
        </>
    );
};

export default ScrambleSetsValidators;
