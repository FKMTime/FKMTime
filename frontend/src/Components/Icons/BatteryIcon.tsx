import {
    Battery,
    BatteryFull,
    BatteryLow,
    BatteryMedium,
    BatteryWarning,
} from "lucide-react";

interface BatteryIconProps {
    batteryPercentage: number;
}

const BatteryIcon = ({ batteryPercentage }: BatteryIconProps) => {
    if (batteryPercentage >= 95) {
        return <BatteryFull />;
    } else if (batteryPercentage >= 60) {
        return <BatteryMedium />;
    } else if (batteryPercentage >= 30) {
        return <BatteryLow />;
    } else if (batteryPercentage >= 15) {
        return <BatteryWarning />;
    } else {
        return <Battery />;
    }
};

export default BatteryIcon;
