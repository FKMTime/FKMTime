import { MdPublic } from "react-icons/md";
import Flag from "react-world-flags";

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
