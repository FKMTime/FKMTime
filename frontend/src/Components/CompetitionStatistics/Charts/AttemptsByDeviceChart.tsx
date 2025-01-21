import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import {
    ChartConfig,
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from "@/Components/ui/chart";
import { DeviceStatistics } from "@/lib/interfaces";

const chartConfig = {
    count: {
        label: "Attempts",
        color: "hsl(var(--chart-1))",
    },
} satisfies ChartConfig;

interface AttemptsByDeviceChartProps {
    data: DeviceStatistics[];
}

const AttemptsByDeviceChart = ({ data }: AttemptsByDeviceChartProps) => {
    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle>Attempts by device</CardTitle>
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
                                dataKey="deviceName"
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
                                dataKey="count"
                                fill="var(--color-count)"
                                radius={4}
                            />
                        </BarChart>
                    </ChartContainer>
                </CardContent>
            </Card>
        </>
    );
};

export default AttemptsByDeviceChart;
