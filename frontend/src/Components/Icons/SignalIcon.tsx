import { Wifi, WifiHigh, WifiLow, WifiZero } from "lucide-react";

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

const iconFor = (signal: StationSignal) => {
    if (signal.level === "weak") return { Icon: WifiLow, tone: "text-warning" };
    if (signal.level === "ok")
        return {
            Icon:
                signal.rssi !== null && signal.rssi > STRONG_ABOVE_DBM
                    ? Wifi
                    : WifiHigh,
            tone: "text-muted-foreground",
        };
    return { Icon: WifiZero, tone: "text-faint" };
};

interface SignalIconProps {
    signal: StationSignal;
    className?: string;
}

/** A station's Wi-Fi signal, with what to do about it in the tooltip (SPEC-008) */
const SignalIcon = ({ signal, className }: SignalIconProps) => {
    const { Icon, tone } = iconFor(signal);
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
                    <Icon className="size-[18px]" aria-hidden />
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
