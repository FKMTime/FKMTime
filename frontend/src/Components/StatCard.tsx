import {
    Box,
    Flex,
    Stat,
    StatLabel,
    StatNumber,
    Text,
    useColorModeValue,
} from "@chakra-ui/react";
import { motion } from "framer-motion";
import { ReactNode } from "react";

interface StatCardProps {
    title: string;
    stat: string;
    icon: ReactNode;
}

const StatCard = ({ title, stat, icon }: StatCardProps) => {
    return (
        <Stat
            px={{ base: 2, md: 4 }}
            py={"5"}
            shadow={"xl"}
            border={"1px solid"}
            backgroundColor={"gray.500"}
            borderColor={useColorModeValue("gray.800", "gray.500")}
            rounded={"lg"}
            minHeight="fit-content"
            maxHeight="15vh"
        >
            <Flex justifyContent={"space-between"}>
                <Box pl={{ base: 2, md: 4 }}>
                    <StatLabel
                        fontWeight={"medium"}
                        fontSize={"xl"}
                        display="flex"
                        gap={3}
                        justifyContent="space-between"
                    >
                        <Text>{title}</Text>
                        {icon}
                    </StatLabel>

                    <StatNumber
                        fontSize={"2xl"}
                        fontWeight={"medium"}
                        key={stat}
                    >
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, ease: "easeOut" }}
                        >
                            {stat}
                        </motion.div>
                    </StatNumber>
                </Box>
            </Flex>
        </Stat>
    );
};

export default StatCard;
