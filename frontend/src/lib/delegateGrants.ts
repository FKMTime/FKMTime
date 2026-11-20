import { PublicUser, User } from "./interfaces";
import { queryFamily } from "./queryCache";
import { queryClient } from "./queryClient";
import { backendQuery, backendRequest } from "./request";

/**
 * Delegate access for one group (SPEC-013): a delegate lets a user resolve
 * incidents of the group while it runs, plus the actions ticked here.
 */
export type DelegateGrantPermission =
    | "GIVE_EXTRA"
    | "ADD_ATTEMPT"
    | "REORDER_ATTEMPTS"
    | "EDIT_ATTEMPT"
    | "DELETE_ATTEMPT"
    | "EXTRAS_FOR_SEVERAL"
    | "DNF_ALL";

export interface PermissionOption {
    value: DelegateGrantPermission;
    label: string;
    /** Ticked when the dialog opens */
    byDefault: boolean;
}

export const PERMISSION_OPTIONS: PermissionOption[] = [
    { value: "GIVE_EXTRA", label: "Give an extra", byDefault: true },
    { value: "ADD_ATTEMPT", label: "Add an attempt", byDefault: true },
    {
        value: "REORDER_ATTEMPTS",
        label: "Reorder attempts",
        byDefault: true,
    },
    {
        value: "EDIT_ATTEMPT",
        label: "Edit an attempt that isn't an incident",
        byDefault: false,
    },
    { value: "DELETE_ATTEMPT", label: "Delete an attempt", byDefault: false },
    {
        value: "EXTRAS_FOR_SEVERAL",
        label: "Give extras for several attempts",
        byDefault: false,
    },
    { value: "DNF_ALL", label: "DNF all attempts", byDefault: false },
];

export const DEFAULT_PERMISSIONS = PERMISSION_OPTIONS.filter(
    (option) => option.byDefault
).map((option) => option.value);

interface GrantBase {
    id: string;
    userId: string;
    groupId: string;
    /** "3x3x3 Cube, Round 1, Group 2" */
    groupName: string;
    permissions: DelegateGrantPermission[];
    createdAt: string;
    activatedAt: string | null;
    endedAt: string | null;
    createdBy: PublicUser | null;
}

/** One of the signed-in user's own grants, active or waiting */
export interface MyDelegateGrant extends GrantBase {
    roundId: string;
    /** Its group is running */
    active: boolean;
}

/** A grant as delegates see it */
export interface DelegateGrant extends GrantBase {
    user: { id: string; fullName: string | null; username: string | null };
    endedBy: PublicUser | null;
    actionCount: number;
}

export interface DelegateGrantAction {
    id: string;
    grantId: string;
    kind: string;
    resultId: string | null;
    attemptId: string | null;
    personName: string | null;
    summary: string;
    createdAt: string;
}

export const myDelegateGrantsQuery = backendQuery<MyDelegateGrant[]>(
    "delegate-grant/mine"
);

export const delegateGrantsQuery = queryFamily((groupId) =>
    backendQuery<DelegateGrant[]>(
        groupId
            ? `delegate-grant?groupId=${encodeURIComponent(groupId)}`
            : "delegate-grant"
    )
);

export const delegateGrantActionsQuery = queryFamily((grantId) =>
    backendQuery<DelegateGrantAction[]>(`delegate-grant/${grantId}/actions`)
);

/** Refetches every list of grants and their actions on screen */
export const invalidateDelegateGrants = () =>
    queryClient.invalidateQueries({
        predicate: ({ queryKey: [path] }) =>
            typeof path === "string" && path.startsWith("delegate-grant"),
    });

export const giveDelegateGrant = async (data: {
    userId: string;
    groupId: string;
    permissions: DelegateGrantPermission[];
}) => {
    const response = await backendRequest("delegate-grant", "POST", true, data);
    const body = await response.json().catch(() => ({}));
    return { status: response.status, message: body.message as string };
};

export const endDelegateGrant = async (id: string) => {
    const response = await backendRequest(
        `delegate-grant/${id}/end`,
        "POST",
        true
    );
    return response.status;
};

export const grantUserName = (grant: DelegateGrant) =>
    grant.user.fullName ?? grant.user.username ?? "Unknown user";

export type GrantState = "active" | "waiting" | "ended";

export const grantState = (grant: GrantBase): GrantState =>
    grant.endedAt ? "ended" : grant.activatedAt ? "active" : "waiting";

/** Users who can be given access: not delegates, who can do it all already */
export const grantableUsers = (users: User[]) =>
    users.filter(
        (user) =>
            !user.roles.includes("DELEGATE") && !user.roles.includes("ADMIN")
    );

const giverName = (grant: MyDelegateGrant) =>
    grant.createdBy?.fullName ?? "a delegate";

/** The banner line for one of the user's own grants */
export const describeGrant = (grant: MyDelegateGrant) =>
    grant.active
        ? `Delegate access for ${grant.groupName}, given by ${giverName(grant)}. Ends when the group ends.`
        : `Delegate access for ${grant.groupName}, given by ${giverName(grant)}. Starts when the group starts.`;
