import { ArrowLeft, LogOut, Volume2, VolumeX } from "lucide-react";
import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import ModeToggle from "@/Components/ModeToggle";
import { Button } from "@/Components/ui/button";
import { useScanSoundSetting } from "@/lib/scanSound";
import { logoutScramblingDevice } from "@/lib/scramblingDevicesAuth";

import { useScramblingDeviceRoom } from "../scramblingDeviceContext";

interface DevicePageProps {
    title: string;
    /** Home has Log out; inner pages have a back button instead */
    isHome?: boolean;
    children: ReactNode;
}

/** Sticky device header and the 1000px content column */
const DevicePage = ({ title, isHome, children }: DevicePageProps) => {
    const navigate = useNavigate();
    const room = useScramblingDeviceRoom();
    const [isScanSoundOn, setIsScanSoundOn] = useScanSoundSetting();

    const handleLogout = () => {
        logoutScramblingDevice();
        navigate("/auth/login");
    };

    return (
        <>
            <header className="sticky top-0 z-10 flex min-h-[62px] items-center gap-3 border-b bg-card px-4 py-3 sm:px-6">
                {!isHome && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="-ml-2 shrink-0 text-foreground md:size-10 [&_svg]:size-[22px]"
                        aria-label="Home"
                        title="Home"
                        onClick={() => navigate("/scrambling-device")}
                    >
                        <ArrowLeft />
                    </Button>
                )}
                <div className="flex min-w-0 flex-1 flex-col">
                    <h1 className="truncate text-base font-bold">{title}</h1>
                    <span className="text-xs text-muted-foreground">
                        Scrambling device
                        {room?.name ? ` · ${room.name}` : ""}
                    </span>
                </div>
                <Button
                    variant="outline"
                    size="icon"
                    className="shrink-0 border-border md:size-10"
                    aria-pressed={isScanSoundOn}
                    aria-label="Scan sounds"
                    title={isScanSoundOn ? "Scan sounds on" : "Scan sounds off"}
                    onClick={() => setIsScanSoundOn(!isScanSoundOn)}
                >
                    {isScanSoundOn ? <Volume2 /> : <VolumeX />}
                </Button>
                <ModeToggle className="shrink-0 md:size-10" />
                {isHome && (
                    <Button
                        variant="outline"
                        className="shrink-0 border-border px-3"
                        onClick={handleLogout}
                    >
                        <LogOut />
                        Log out
                    </Button>
                )}
            </header>
            <main className="mx-auto flex w-full max-w-[1000px] flex-1 flex-col gap-4 px-4 pb-12 pt-5 sm:px-6">
                {children}
            </main>
        </>
    );
};

export default DevicePage;
