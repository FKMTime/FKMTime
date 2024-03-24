import {
    MdBattery0Bar,
    MdBattery1Bar,
    MdBattery2Bar,
    MdBattery3Bar,
    MdBattery4Bar,
    MdBattery5Bar,
    MdBattery6Bar,
    MdBatteryFull,
} from "react-icons/md";

interface BatteryIconProps {
    batteryPercentage: number;
}

const BatteryIcon = ({ batteryPercentage }: BatteryIconProps) => {
    if (batteryPercentage >= 98) {
        return <MdBatteryFull />;
    } else if (batteryPercentage >= 85) {
        return <MdBattery6Bar />;
    } else if (batteryPercentage >= 70) {
        return <MdBattery5Bar />;
    } else if (batteryPercentage >= 55) {
        return <MdBattery4Bar />;
    } else if (batteryPercentage >= 45) {
        return <MdBattery3Bar />;
    } else if (batteryPercentage >= 30) {
        return <MdBattery2Bar />;
    } else if (batteryPercentage >= 15) {
        return <MdBattery1Bar />;
    } else {
        return <MdBattery0Bar />;
    }
};

export default BatteryIcon;
