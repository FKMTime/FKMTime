import { useMemo, useState } from "react";
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
    const [longestTick, setLongestTick] = useState("");

    const tickFormatter = (val: number) => {
        const formattedTick = `${val} min`;
        if (longestTick.length < formattedTick.length) {
            setLongestTick(formattedTick);
        }
        return formattedTick;
    };

    const getYAxisTickLen = () => {
        const charWidth = 8;
        return longestTick.length * charWidth;
    };

    const maxDelay = useMemo(() => {
        return Math.max(
            ...data.roundsStatistics.map((r) => r.delayInMinutes || 0)
        );
    }, [data]);

    const yTicks = useMemo(() => {
        const roundedMax = Math.ceil(maxDelay / 5) * 5;
        const ticks = [];
        for (let i = 0; i <= roundedMax; i += 5) {
            ticks.push(i);
        }
        return ticks;
    }, [maxDelay]);

    return (
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
                <ChartContainer config={chartConfig}>
                    <LineChart
                        accessibilityLayer
                        data={data.roundsStatistics}
                        height={200}
                        margin={{
                            left: 12,
                            right: 12,
                            top: 10,
                            bottom: 10,
                        }}
                    >
                        <CartesianGrid vertical={false} />
                        <YAxis
                            axisLine={false}
                            tickLine={false}
                            tickMargin={8}
                            domain={[0, "auto"]}
                            tickFormatter={tickFormatter}
                            width={getYAxisTickLen()}
                            ticks={yTicks}
                        />
                        <XAxis
                            dataKey="roundName"
                            tickLine={false}
                            axisLine={false}
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
    );
};

export default DelayChart;
