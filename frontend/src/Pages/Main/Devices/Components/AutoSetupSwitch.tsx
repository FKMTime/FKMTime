import { WandSparkles } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/Components/ui/button";
import { useIsMobile } from "@/hooks/useMobile";
import { useToast } from "@/hooks/useToast";
import { competitionSettingsQuery } from "@/lib/competition";
import { fetchQuery } from "@/lib/queryCache";
import { cn } from "@/lib/utils";
import { socket } from "@/socket";

const formatRemaining = (ms: number) => {
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

interface AutoSetupSwitchProps {
    /** Local time the server will switch it off at; null while off */
    endsAt: number | null;
    /** How long a run lasts, for the bar that drains as it runs out */
    durationMs: number;
}

/**
 * Switches the stations' auto setup mode. The server turns it off by itself
 * after a few minutes, so this shows the time left until then.
 */
export const AutoSetupSwitch = ({
    endsAt,
    durationMs,
}: AutoSetupSwitchProps) => {
    const { toast } = useToast();
    const isMobile = useIsMobile();
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        if (endsAt === null) return;
        // Ticks at once too: `now` is stale after a while switched off
        const tick = () => setNow(Date.now());
        const first = setTimeout(tick, 0);
        const interval = setInterval(tick, 1000);
        return () => {
            clearTimeout(first);
            clearInterval(interval);
        };
    }, [endsAt]);

    const isOn = endsAt !== null;
    const remainingMs = isOn ? Math.max(0, endsAt - now) : 0;
    const remainingShare =
        durationMs > 0 ? Math.min(1, remainingMs / durationMs) : 1;

    const handleCheckedChange = async (checked: boolean) => {
        if (!checked) {
            socket.emit("autosetup:stop");
            return;
        }
        const data = await fetchQuery(competitionSettingsQuery).catch(
            () => null
        );
        if (!data) {
            toast({
                title: "Error",
                description: "Something went wrong",
                variant: "destructive",
            });
            return;
        }
        if (!data.wifiSsid || !data.wifiPassword) {
            toast({
                title: "WiFi details are missing",
                description:
                    "Set the WiFi SSID and password in the Settings tab before running auto setup",
                variant: "destructive",
            });
            return;
        }
        socket.emit("autosetup:start");
    };

    // A button acting as the switch, so it matches "Add device" next to it;
    // while on it takes the tint of the connection requests it brings in
    return (
        <Button
            variant="outline"
            size={isMobile ? "lg" : "default"}
            className={cn(
                "relative overflow-hidden max-md:flex-1",
                isOn &&
                    "border-primary bg-primary/15 text-primary shadow-[0_0_0_3px] shadow-primary/15 hover:bg-primary/25 hover:text-primary"
            )}
            role="switch"
            aria-checked={isOn}
            title={isOn ? "Stop auto setup" : "New devices set themselves up"}
            onClick={() => void handleCheckedChange(!isOn)}
        >
            {isOn ? (
                <span aria-hidden className="relative flex size-2.5">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-75" />
                    <span className="relative inline-flex size-2.5 rounded-full bg-primary" />
                </span>
            ) : (
                <WandSparkles />
            )}
            Auto setup
            {isOn && (
                <span
                    className="min-w-[2.5em] text-right font-medium tabular-nums opacity-80"
                    aria-label="Time left"
                >
                    {formatRemaining(remainingMs)}
                </span>
            )}
            {isOn && (
                <span
                    aria-hidden
                    className="absolute inset-x-0 bottom-0 h-[3px] origin-left bg-primary transition-transform duration-1000 ease-linear"
                    style={{ transform: `scaleX(${remainingShare})` }}
                />
            )}
        </Button>
    );
};
