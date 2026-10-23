import { ChevronRight, LogOut } from "lucide-react";
import { Link } from "react-router-dom";

import { useLogout } from "@/hooks/useLogout";
import { useNavItems } from "@/hooks/useNavItems";
import { isMobileTab, NavGroup } from "@/lib/navigation";

const MORE_GROUPS: NavGroup[] = ["Competition day", "Admin", "Account"];

/**
 * Overflow menu for everything that is not a bottom tab. Only linked from the
 * mobile tab bar; on desktop the sidebar lists the same items.
 */
const More = () => {
    const { items } = useNavItems();
    const handleLogout = useLogout();

    return (
        <div className="flex flex-col gap-5">
            {MORE_GROUPS.map((group) => {
                const groupItems = items.filter(
                    (item) => item.group === group && !isMobileTab(item)
                );
                if (!groupItems.length) return null;
                return (
                    <section key={group} className="flex flex-col gap-2">
                        <h2 className="pl-1 text-xs font-semibold text-faint">
                            {group}
                        </h2>
                        <div className="flex flex-col overflow-hidden rounded-mobile-card border bg-card">
                            {groupItems.map((item) => {
                                const Icon = item.icon;
                                return (
                                    <Link
                                        key={item.id}
                                        to={item.to}
                                        className="flex h-[54px] items-center gap-3.5 border-b px-3.5 text-[15px] font-medium last:border-b-0 active:bg-accent"
                                    >
                                        <Icon className="size-[22px] text-muted-foreground" />
                                        <span className="flex-1">
                                            {item.label}
                                        </span>
                                        <ChevronRight className="size-5 text-faint" />
                                    </Link>
                                );
                            })}
                        </div>
                    </section>
                );
            })}
            <button
                onClick={handleLogout}
                className="flex h-[52px] items-center justify-center gap-2 rounded-mobile-card border bg-card text-[15px] font-semibold text-destructive active:bg-accent"
            >
                <LogOut className="size-5" />
                Log out
            </button>
        </div>
    );
};

export default More;
