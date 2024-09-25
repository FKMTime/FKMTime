import { Box } from "@chakra-ui/react";

interface Props {
    size: number;
    username?: string;
    backgroundColor?: string;
    className?: string;
}

const DefaultAvatar = ({ size, username, className }: Props) => {
    return (
        <Box
            className={className}
            bg="gray.600"
            display="flex"
            justifyContent="center"
            alignItems="center"
            borderRadius="full"
            padding={2}
            width={size}
            height={size}
        >
            <p style={{ color: "white", fontSize: size / 2 }}>
                {username && username[0].toUpperCase()}
            </p>
        </Box>
    );
};

export default DefaultAvatar;
