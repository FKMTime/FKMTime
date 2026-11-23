const TICK_STEP_MINUTES = 5;

/**
 * Y axis ticks for the delay chart, every 5 minutes. The range always
 * includes 0 and extends below it when a round started early (negative
 * delay), so no point is drawn outside the chart.
 *
 * The backend sends delays as strings ("-5.00"), so values are converted
 * here; anything that is not a number is ignored.
 */
export const delayAxisTicks = (
    delays: (number | string | null | undefined)[]
) => {
    const known = delays
        .filter((d) => d !== null && d !== undefined && d !== "")
        .map(Number)
        .filter(Number.isFinite);
    const min = Math.min(0, ...known);
    const max = Math.max(0, ...known);
    const from = Math.floor(min / TICK_STEP_MINUTES) * TICK_STEP_MINUTES;
    const to = Math.ceil(max / TICK_STEP_MINUTES) * TICK_STEP_MINUTES;

    const ticks: number[] = [];
    for (let tick = from; tick <= to; tick += TICK_STEP_MINUTES) {
        ticks.push(tick);
    }
    return ticks;
};
