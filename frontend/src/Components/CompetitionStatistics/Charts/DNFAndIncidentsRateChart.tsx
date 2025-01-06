import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import {
    ChartConfig,
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from "@/Components/ui/chart";
import { EventStatistics } from "@/lib/interfaces";

const chartConfig = {
    attempts: {
        label: "Attempts",
        color: "hsl(var(--chart-1))",
    },
    dnf: {
        label: "DNF",
        color: "hsl(var(--chart-2))",
    },
    incidents: {
        label: "Incidents",
        color: "hsl(var(--chart-3))",
    },
} satisfies ChartConfig;

interface DNFAndIncidentsRateChartProps {
    data: EventStatistics[];
}

const DNFAndIncidentsRateChart = ({ data }: DNFAndIncidentsRateChartProps) => {
    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle>DNF and incidents rate</CardTitle>
                </CardHeader>
                <CardContent>
                    <ChartContainer
                        config={chartConfig}
                        className="h-64 w-full"
                    >
                        <BarChart accessibilityLayer data={data}>
                            <CartesianGrid vertical={false} />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tickMargin={8}
                                tickFormatter={(value) => value}
                            />
                            <XAxis
                                dataKey="eventName"
                                tickLine={false}
                                tickMargin={10}
                                axisLine={false}
                                tickFormatter={(value) => value}
                            />
                            <ChartTooltip
                                cursor={false}
                                content={
                                    <ChartTooltipContent indicator="dashed" />
                                }
                            />
                            <Bar
                                dataKey="attempts"
                                fill="var(--color-attempts)"
                                radius={4}
                            />
                            <Bar
                                dataKey="dnf"
                                fill="var(--color-dnf)"
                                radius={4}
                            />
                            <Bar
                                dataKey="incidents"
                                fill="var(--color-incidents)"
                                radius={4}
                            />
                        </BarChart>
                    </ChartContainer>
                </CardContent>
            </Card>
        </>
    );
};

export default DNFAndIncidentsRateChart;
