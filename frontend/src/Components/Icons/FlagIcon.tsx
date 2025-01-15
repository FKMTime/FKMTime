import { Flag64 as Flag } from "@weston/react-world-flags";
import { Globe } from "lucide-react";

import { regionNameByIso2 } from "@/lib/utils";

import Tooltip from "../Tooltip";

interface FlagIconProps {
    country?: string;
    size?: number;
}

const FlagIcon = ({ country, size }: FlagIconProps) => {
    if (country) {
        return (
            <Tooltip content={regionNameByIso2(country) || ""}>
                <Flag code={country.toLowerCase()} width={size} height={size} />
            </Tooltip>
        );
    } else {
        return <Globe />;
    }
};

export default FlagIcon;
