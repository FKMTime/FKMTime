import { Globe } from "lucide-react";

import { regionNameByIso2 } from "@/lib/utils";

import Tooltip from "../Tooltip";

interface FlagIconProps {
    country?: string;
    size?: number;
}

// The WCA's multi-country regions (XA, XE, XM, ...) have no flag
const hasFlag = (country: string) => !/^x/i.test(country);

const FlagIcon = ({ country, size }: FlagIconProps) => {
    if (country && hasFlag(country)) {
        return (
            <Tooltip content={regionNameByIso2(country) || ""}>
                {/* flag-icons sizes the square flag (fis) from the font size */}
                <span
                    className={`fi fis fi-${country.toLowerCase()}`}
                    style={size ? { fontSize: size } : undefined}
                />
            </Tooltip>
        );
    } else {
        return <Globe />;
    }
};

export default FlagIcon;
