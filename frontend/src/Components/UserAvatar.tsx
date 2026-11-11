import { Avatar, AvatarFallback, AvatarImage } from "@/Components/ui/avatar";
import { cn, getInitials } from "@/lib/utils";

interface UserAvatarProps {
    fullName?: string;
    avatarUrl?: string;
    className?: string;
}

const UserAvatar = ({ fullName, avatarUrl, className }: UserAvatarProps) => (
    <Avatar className={cn("size-9", className)}>
        {avatarUrl && <AvatarImage src={avatarUrl} alt={fullName} />}
        <AvatarFallback className="bg-primary-soft text-[13px] font-bold text-primary">
            {getInitials(fullName)}
        </AvatarFallback>
    </Avatar>
);

export default UserAvatar;
