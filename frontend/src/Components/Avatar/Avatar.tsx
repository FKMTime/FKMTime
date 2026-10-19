import { useState } from "react";

import {
    Avatar as ShadcnAvatar,
    AvatarFallback,
    AvatarImage,
} from "@/Components/ui/avatar";
import { cn, getInitials } from "@/lib/utils";

import AvatarModal from "./AvatarModal";

interface AvatarProps {
    avatarUrl?: string;
    fullAvatarUrl?: string;
    username?: string;
    className?: string;
}

/** WCA avatar thumbnail that opens the full photo; initials when there is none */
const Avatar = ({
    avatarUrl,
    fullAvatarUrl,
    username,
    className,
}: AvatarProps) => {
    const [isOpenAvatarModal, setIsOpenAvatarModal] = useState<boolean>(false);

    return (
        <>
            <ShadcnAvatar className={cn("size-8", className)}>
                <AvatarImage
                    src={avatarUrl}
                    alt={username}
                    onClick={() => setIsOpenAvatarModal(true)}
                    className="cursor-pointer object-cover"
                />
                <AvatarFallback className="bg-secondary text-[11px] font-bold text-muted-foreground">
                    {getInitials(username)}
                </AvatarFallback>
            </ShadcnAvatar>
            {fullAvatarUrl && (
                <AvatarModal
                    isOpen={isOpenAvatarModal}
                    onClose={() => setIsOpenAvatarModal(false)}
                    avatarUrl={fullAvatarUrl}
                />
            )}
        </>
    );
};

export default Avatar;
