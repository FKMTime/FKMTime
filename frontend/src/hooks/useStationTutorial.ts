import { useToast } from "@/hooks/useToast";
import { Device } from "@/lib/interfaces";
import { setStationTutorial } from "@/lib/tutorial";

/**
 * Starts and ends tutorial mode on a station, saying how it went (SPEC-012).
 * `onChanged` refreshes whatever list shows the station
 */
export const useStationTutorial = (onChanged: () => void) => {
    const { toast } = useToast();

    const set = async (station: Device, enabled: boolean) => {
        const status = await setStationTutorial(station.id, enabled);
        if (status !== 200) {
            toast({
                title: enabled
                    ? "The tutorial didn't start"
                    : "The tutorial didn't end",
                variant: "destructive",
            });
            return false;
        }
        toast({
            title: enabled
                ? `${station.name} is in tutorial mode`
                : `${station.name} is back to normal`,
            description: enabled
                ? "Its solves aren't saved until the tutorial ends."
                : undefined,
            variant: "success",
        });
        onChanged();
        return true;
    };

    return {
        startTutorial: (station: Device) => set(station, true),
        endTutorial: (station: Device) => set(station, false),
    };
};
