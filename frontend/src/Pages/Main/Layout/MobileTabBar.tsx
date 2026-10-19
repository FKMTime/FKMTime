import { Menu } from "lucide-react";
import { useEffect } from "react";
import { Link } from "react-router-dom";

import {
    isMobileTab,
    MOBILE_TAB_IDS,
    MORE_PATH,
    NavItem,
} from "@/lib/navigation";
import { cn } from "@/lib/utils";

interface MobileTabBarProps {
    items: NavItem[];
    activeItem?: NavItem;
    pathname: string;
    unresolvedIncidentsCount: number;
}

/** Keeps toasts above the tab bar while it is mounted */
const TOAST_OFFSET = "76px";

const MobileTabBar = ({
    items,
    activeItem,
    pathname,
    unresolvedIncidentsCount,
}: MobileTabBarProps) => {
    useEffect(() => {
        const root = document.documentElement;
        root.style.setProperty("--toast-offset", TOAST_OFFSET);
        return () => {
            root.style.removeProperty("--toast-offset");
        };
    }, []);

    const tabs = MOBILE_TAB_IDS.map((id) =>
        items.find((item) => item.id === id)
    ).filter((item): item is NavItem => !!item);
    const isMoreActive =
        pathname === MORE_PATH || (!!activeItem && !isMobileTab(activeItem));

    return (
        <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t bg-card px-1.5 pb-[max(env(safe-area-inset-bottom),0.375rem)] pt-1.5 md:hidden">
            {tabs.map((item) => (
                <TabLink
                    key={item.id}
                    to={item.to}
                    label={item.label}
                    icon={item.icon}
                    isActive={!isMoreActive && item.id === activeItem?.id}
                    badge={
                        item.id === "incidents" ? unresolvedIncidentsCount : 0
                    }
                />
            ))}
            <TabLink
                to={MORE_PATH}
                label="More"
                icon={Menu}
                isActive={isMoreActive}
                badge={0}
            />
        </nav>
    );
};

interface TabLinkProps {
    to: string;
    label: string;
    icon: NavItem["icon"];
    isActive: boolean;
    badge: number;
}

const TabLink = ({ to, label, icon: Icon, isActive, badge }: TabLinkProps) => (
    <Link
        to={to}
        aria-current={isActive ? "page" : undefined}
        className={cn(
            "flex h-[52px] flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold",
            isActive ? "text-primary" : "text-muted-foreground"
        )}
    >
        <span className="relative">
            <Icon
                className={cn("size-6", isActive && "fill-primary/20")}
                strokeWidth={isActive ? 2.25 : 2}
            />
            {badge > 0 && (
                <span className="absolute -right-2.5 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-destructive px-[5px] text-[11px] font-bold text-destructive-foreground">
                    {badge}
                </span>
            )}
        </span>
        {label}
    </Link>
);

export default MobileTabBar;
