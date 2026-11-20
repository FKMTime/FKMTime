import { useLiveQuery } from "@/hooks/useLiveQuery";
import { getUserInfo } from "@/lib/auth";
import {
    DelegateGrantPermission,
    MyDelegateGrant,
    myDelegateGrantsQuery,
} from "@/lib/delegateGrants";
import { isDelegate } from "@/lib/permissions";

export interface DelegateAccess {
    /** A delegate or admin: everything is allowed, grants don't matter */
    isDelegate: boolean;
    /** The user's grants that haven't ended, active or waiting */
    grants: MyDelegateGrant[];
    /** Grants whose group is running */
    active: MyDelegateGrant[];
    /** Can open the incidents page: a delegate, or holding a grant */
    canSeeIncidents: boolean;
    /** Whether any active grant includes the action; the server checks the competitor */
    can: (permission: DelegateGrantPermission) => boolean;
}

/**
 * What the signed-in user may do as a delegate: everything for delegates,
 * what a delegate ticked for users with access for a group (SPEC-013).
 */
export const useDelegateAccess = (): DelegateAccess => {
    const delegate = isDelegate();
    const { data } = useLiveQuery(myDelegateGrantsQuery, {
        enabled: !delegate && !!getUserInfo(),
    });
    const grants = delegate ? [] : data ?? [];
    const active = grants.filter((grant) => grant.active);
    return {
        isDelegate: delegate,
        grants,
        active,
        canSeeIncidents: delegate || grants.length > 0,
        can: (permission) =>
            delegate ||
            active.some((grant) => grant.permissions.includes(permission)),
    };
};
