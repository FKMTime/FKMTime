import { Flag64 as Flag } from "@weston/react-world-flags";
import { MdPublic } from "react-icons/md";

interface FlagIconProps {
    country?: string;
    size?: number;
}

const FlagIcon = ({ country, size }: FlagIconProps) => {
    if (country) {
        return <Flag code={country.toLowerCase()} width={size} height={size} />;
    } else {
        return <MdPublic />;
    }
};

export default FlagIcon;
