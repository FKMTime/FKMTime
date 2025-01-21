import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/Components/ui/card";
import {
    ChartConfig,
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from "@/Components/ui/chart";
import { RoundStatisticsByDay } from "@/lib/interfaces";

const chartConfig = {
    delayInMinutes: {
        label: "Delay",
        color: "hsl(var(--chart-1))",
    },
} satisfies ChartConfig;

interface DelayChartData {
    data: RoundStatisticsByDay;
}

const DelayChart = ({ data }: DelayChartData) => {
    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle>
                        Delay for {new Date(data.date).toLocaleDateString()}
                    </CardTitle>
                    <CardDescription>
                        Scheduled start time and time of the first solve are
                        compared
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <ChartContainer
                        config={chartConfig}
                        className="h-64 w-full"
                    >
                        <LineChart
                            accessibilityLayer
                            data={data.roundsStatistics}
                            margin={{
                                left: 12,
                                right: 12,
                            }}
                        >
                            <CartesianGrid vertical={false} />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tickMargin={8}
                                tickFormatter={(value) => `${value} min`}
                            />
                            <XAxis
                                dataKey="roundName"
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(value) => value}
                            />
                            <ChartTooltip
                                cursor={false}
                                content={<ChartTooltipContent hideLabel />}
                            />
                            <Line
                                dataKey="delayInMinutes"
                                type="natural"
                                strokeWidth={2}
                                dot={false}
                            />
                        </LineChart>
                    </ChartContainer>
                </CardContent>
            </Card>
        </>
    );
};

export default DelayChart;
