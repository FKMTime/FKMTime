import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/Components/ui/tooltip";
import { StationLink, StationSignal } from "@/lib/interfaces";
import { cn } from "@/lib/utils";

/** An ok station above this gets full bars (dBm) */
const STRONG_ABOVE_DBM = -55;

const dbm = (value: number) => `${value < 0 ? "−" : ""}${Math.abs(value)} dBm`;

const mbits = (kbps: number) =>
    `${Number((kbps / 1000).toFixed(kbps < 10_000 ? 1 : 0))} Mbit/s`;

const actionLine = (signal: StationSignal) => {
    if (signal.level === "weak")
        return "Weak signal — move closer to the router";
    if (signal.level === "ok") return "Good signal";
    return signal.reportedRssi
        ? "Waiting for the station"
        : "Needs newer station firmware";
};

const routerLine = (link: StationLink) => {
    const parts = [
        link.apSignal !== null && `Router hears it at ${dbm(link.apSignal)}`,
        link.txBitrateKbps !== null && `sends at ${mbits(link.txBitrateKbps)}`,
        link.txRetriesPercent !== null && `retries ${link.txRetriesPercent}%`,
    ].filter(Boolean) as string[];
    if (parts.length === 0) return null;
    const text = parts.join(", ");
    return text.charAt(0).toUpperCase() + text.slice(1);
};

/** The tooltip's lines: what to do first, then the readings behind it */
const signalDescription = (signal: StationSignal) =>
    [
        actionLine(signal),
        signal.rssi !== null &&
            `${dbm(signal.rssi)} (median of the last 5 readings)`,
        // Most setups don't run on the router: no line rather than "unavailable"
        signal.link && routerLine(signal.link),
    ].filter(Boolean) as string[];

/** How many of the three arcs are lit, and in which colour */
const barsFor = (signal: StationSignal) => {
    if (signal.level === "weak") return { bars: 1, tone: "text-warning" };
    if (signal.level === "ok")
        return {
            bars:
                signal.rssi !== null && signal.rssi > STRONG_ABOVE_DBM ? 3 : 2,
            tone: "text-foreground",
        };
    return { bars: 0, tone: "text-muted-foreground" };
};

/** Arcs from the innermost out, the same geometry as Lucide's Wi-Fi icon */
const ARCS = [
    "M8.5 16.429a5 5 0 0 1 7 0",
    "M5 12.859a10 10 0 0 1 14 0",
    "M2 8.82a15 15 0 0 1 20 0",
];

/** Unlit arcs stay drawn, so every state is the same size */
const UNLIT_OPACITY = 0.25;

/**
 * Always all three arcs with the unlit ones dimmed, like a phone's status bar:
 * a weaker signal reads as fewer bright bars, not as a smaller icon. No
 * reading at all dims everything, dot included.
 */
const WifiBars = ({ bars }: { bars: number }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.25}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-6"
        data-bars={bars}
        aria-hidden
    >
        <path d="M12 20h.01" strokeOpacity={bars > 0 ? 1 : UNLIT_OPACITY} />
        {ARCS.map((d, index) => (
            <path
                key={d}
                d={d}
                strokeOpacity={index < bars ? 1 : UNLIT_OPACITY}
            />
        ))}
    </svg>
);

interface SignalIconProps {
    signal: StationSignal;
    className?: string;
}

/** A station's Wi-Fi signal, with what to do about it in the tooltip (SPEC-008) */
const SignalIcon = ({ signal, className }: SignalIconProps) => {
    const { bars, tone } = barsFor(signal);
    const lines = signalDescription(signal);
    return (
        <TooltipProvider delayDuration={200}>
            <Tooltip>
                <TooltipTrigger
                    type="button"
                    aria-label={lines.join(". ")}
                    className={cn(
                        "inline-flex shrink-0 items-center rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        tone,
                        className
                    )}
                >
                    <WifiBars bars={bars} />
                </TooltipTrigger>
                <TooltipContent>
                    {lines.map((line) => (
                        <p key={line}>{line}</p>
                    ))}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
};

export default SignalIcon;
