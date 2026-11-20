import { useState } from "react";

import { Modal } from "@/Components/Modal";
import ModalActions from "@/Components/ModalActions";
import { Button } from "@/Components/ui/button";
import { Checkbox } from "@/Components/ui/checkbox";
import { Label } from "@/Components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/Components/ui/select";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { useToast } from "@/hooks/useToast";
import { activityCodeToName } from "@/lib/activities";
import {
    DEFAULT_PERMISSIONS,
    DelegateGrantPermission,
    giveDelegateGrant,
    grantableUsers,
    invalidateDelegateGrants,
    PERMISSION_OPTIONS,
} from "@/lib/delegateGrants";
import { User } from "@/lib/interfaces";
import { usersQuery } from "@/lib/user";

interface GiveDelegateAccessModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** Groups to choose from, e.g. a room's running and next groups */
    groupIds: string[];
    /** Picked when the dialog opens */
    defaultGroupId?: string;
}

const userLabel = (user: User) =>
    user.fullName ?? user.username ?? "Unnamed user";

/**
 * Gives a user delegate access for one group (SPEC-013): resolving its
 * incidents while it runs, and the actions ticked here.
 */
const GiveDelegateAccessModal = ({
    isOpen,
    onClose,
    groupIds,
    defaultGroupId,
}: GiveDelegateAccessModalProps) => {
    const { toast } = useToast();
    const { data: users } = useLiveQuery(usersQuery, { enabled: isOpen });
    const [userId, setUserId] = useState("");
    const [groupId, setGroupId] = useState(defaultGroupId ?? groupIds[0] ?? "");
    const [permissions, setPermissions] =
        useState<DelegateGrantPermission[]>(DEFAULT_PERMISSIONS);
    const [error, setError] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    const candidates = grantableUsers(users ?? []).sort((a, b) =>
        userLabel(a).localeCompare(userLabel(b))
    );

    const toggle = (permission: DelegateGrantPermission, on: boolean) =>
        setPermissions((current) =>
            on
                ? [...current, permission]
                : current.filter((p) => p !== permission)
        );

    const handleSubmit = async () => {
        if (!userId) return setError("Choose who gets access");
        if (!groupId) return setError("Choose the group");
        setIsSaving(true);
        const { status, message } = await giveDelegateGrant({
            userId,
            groupId,
            permissions,
        });
        setIsSaving(false);
        if (status !== 201) {
            setError(message ?? "Something went wrong");
            return;
        }
        const user = candidates.find((u) => u.id === userId);
        toast({
            title: `Delegate access given to ${user ? userLabel(user) : "the user"}`,
            description: activityCodeToName(groupId),
            variant: "success",
        });
        void invalidateDelegateGrants();
        onClose();
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Give delegate access"
            error={error}
        >
            <p className="text-sm text-muted-foreground">
                They can resolve incidents of competitors in the group while it
                runs. Access ends by itself when the group ends.
            </p>
            <div className="flex flex-col gap-1.5">
                <Label htmlFor="delegate-access-user">User</Label>
                <Select value={userId} onValueChange={setUserId}>
                    <SelectTrigger id="delegate-access-user">
                        <SelectValue placeholder="Choose a user" />
                    </SelectTrigger>
                    <SelectContent>
                        {candidates.map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                                {userLabel(user)}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            {groupIds.length > 1 && (
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="delegate-access-group">Group</Label>
                    <Select value={groupId} onValueChange={setGroupId}>
                        <SelectTrigger id="delegate-access-group">
                            <SelectValue placeholder="Choose a group" />
                        </SelectTrigger>
                        <SelectContent>
                            {groupIds.map((id) => (
                                <SelectItem key={id} value={id}>
                                    {activityCodeToName(id)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}
            {groupIds.length === 1 && (
                <p className="text-sm">
                    Group:{" "}
                    <span className="font-semibold">
                        {activityCodeToName(groupIds[0])}
                    </span>
                </p>
            )}
            <fieldset className="flex flex-col gap-1">
                <legend className="mb-1 text-sm font-medium">
                    Besides resolving incidents, they can
                </legend>
                {PERMISSION_OPTIONS.map((option) => (
                    <Label
                        key={option.value}
                        className="flex min-h-11 cursor-pointer items-center gap-3 font-normal md:min-h-8"
                    >
                        <Checkbox
                            checked={permissions.includes(option.value)}
                            onCheckedChange={(value) =>
                                toggle(option.value, !!value)
                            }
                        />
                        {option.label}
                    </Label>
                ))}
            </fieldset>
            <ModalActions>
                <Button variant="outline" onClick={onClose}>
                    Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={isSaving}>
                    Give access
                </Button>
            </ModalActions>
        </Modal>
    );
};

export default GiveDelegateAccessModal;
