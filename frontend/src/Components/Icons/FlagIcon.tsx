import { Globe } from "lucide-react";

import { regionNameByIso2 } from "@/lib/utils";

import Tooltip from "../Tooltip";

interface FlagIconProps {
    country?: string;
    size?: number;
    /**
     * Off inside a button or link, which can't hold the tooltip's own
     * button: the region's name is then the flag's label
     */
    withTooltip?: boolean;
}

// The WCA's multi-country regions (XA, XE, XM, ...) have no flag
const hasFlag = (country: string) => !/^x/i.test(country);

const FlagIcon = ({ country, size, withTooltip = true }: FlagIconProps) => {
    if (country && hasFlag(country) && !withTooltip) {
        return (
            <span
                role="img"
                aria-label={regionNameByIso2(country) || country}
                title={regionNameByIso2(country) || undefined}
                className={`fi fis fi-${country.toLowerCase()}`}
                style={size ? { fontSize: size } : undefined}
            />
        );
    }
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
