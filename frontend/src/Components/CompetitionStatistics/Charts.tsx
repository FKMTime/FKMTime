import {
    Box,
    Card,
    CardBody,
    CardHeader,
    Heading,
    Text,
} from "@chakra-ui/react";
import { BarChart, LineChart } from "@saas-ui/charts";

import { CompetitionStatistics } from "@/logic/interfaces";

interface ChartsProps {
    statistics: CompetitionStatistics;
}

const Charts = ({ statistics }: ChartsProps) => {
    return (
        <Box
            display={{ base: "none", md: "flex" }}
            flexDirection="column"
            gap={4}
        >
            <Card backgroundColor="gray.900" color="white">
                <CardHeader pb="0">
                    <Heading as="h4" fontWeight="medium" size="md">
                        DNF and incidents rate
                    </Heading>
                </CardHeader>
                <CardBody>
                    <BarChart
                        //eslint-disable-next-line
                        data={statistics.byEventStats as any}
                        index="eventName"
                        categories={["Attempts", "DNF", "Incidents"]}
                        colors={["green", "blue", "red"]}
                        variant="solid"
                        height="300px"
                    />
                </CardBody>
            </Card>
            {statistics.byRoundStats.map((day) => (
                <Card backgroundColor="gray.900" color="white">
                    <CardHeader
                        display="flex"
                        flexDirection="column"
                        gap={2}
                        mb={-10}
                    >
                        <Heading as="h4" fontWeight="medium" size="md">
                            Delay for {new Date(day.date).toLocaleDateString()}
                        </Heading>
                        <Text color="gray.400">
                            Scheduled start time and time of the first solve are
                            compared
                        </Text>
                    </CardHeader>
                    <CardBody>
                        <LineChart
                            //eslint-disable-next-line
                            data={day.roundsStatistics as any}
                            valueFormatter={(value) =>
                                `${value.toFixed(2)} min`
                            }
                            index="roundName"
                            categories={["Minutes"]}
                            height="300px"
                            colors={["green"]}
                        />
                    </CardBody>
                </Card>
            ))}
        </Box>
    );
};

export default Charts;
