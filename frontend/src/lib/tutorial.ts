import { Activity, Competition as WCIF } from "wcif-helpers";

import { Device, DeviceType } from "./interfaces";
import { showBrowserNotification } from "./notifications";
import { backendQuery, backendRequest } from "./request";
import { isNotificationsSupported } from "./utils";

/** Tutorial mode ends this long after a station was last used for it */
export const TUTORIAL_QUIET_MINUTES = 15;

/** How long before the schedule's tutorial Home suggests starting one */
export const TUTORIAL_SUGGESTION_LEAD_MS = 15 * 60_000;

/** Whether a station takes tutorial solves right now (SPEC-012) */
export const isInTutorial = (device: Device, now = new Date()) =>
    device.type === DeviceType.STATION &&
    !device.retiredAt &&
    !!device.tutorialEndsAt &&
    new Date(device.tutorialEndsAt).getTime() > now.getTime();

export const getTutorialStations = (devices: Device[], now = new Date()) =>
    devices.filter((device) => isInTutorial(device, now));

/** Starts or ends tutorial mode on a station */
export const setStationTutorial = async (id: string, enabled: boolean) => {
    const response = await backendRequest(
        `device/${id}/tutorial`,
        "PUT",
        true,
        { enabled }
    );
    return response.status;
};

/** A delegate call made during a tutorial, kept in the backend's memory */
export interface TutorialIncident {
    id: string;
    espId: number;
    deviceName: string;
    roomId: string;
    competitorName: string;
    judgeName: string | null;
    /** Centiseconds */
    value: number;
    penalty: number;
    inspectionTime: number;
    sessionId: string;
    createdAt: string;
}

export const tutorialIncidentsQuery =
    backendQuery<TutorialIncident[]>("incident/tutorial");

export const resolveTutorialIncident = async (
    id: string,
    data: {
        value: number;
        penalty: number;
        status: "RESOLVED" | "EXTRA_GIVEN";
        doNotRequireCards?: boolean;
    }
) => {
    const response = await backendRequest(
        `incident/tutorial/${id}`,
        "PUT",
        true,
        data
    );
    return response.status;
};

export const deleteTutorialIncident = async (id: string) => {
    const response = await backendRequest(
        `incident/tutorial/${id}`,
        "DELETE",
        true
    );
    return response.status;
};

export interface ScheduledTutorial {
    /** The schedule's own name, e.g. "Tutorial for new competitors" */
    name: string;
    roomName: string;
    startTime: string;
    endTime: string;
    timezone: string;
    /** The activity, so a dismissal is remembered for this one only */
    key: string;
}

/**
 * The schedule's tutorials (`other-tutorial`) that are under way or start
 * soon, for Home to suggest starting tutorial mode
 */
export const getUpcomingTutorials = (
    wcif: WCIF,
    now = new Date()
): ScheduledTutorial[] =>
    wcif.schedule.venues.flatMap((venue) =>
        venue.rooms.flatMap((room) =>
            room.activities
                .filter(
                    (activity: Activity) =>
                        activity.activityCode === "other-tutorial" &&
                        new Date(activity.startTime).getTime() -
                            TUTORIAL_SUGGESTION_LEAD_MS <=
                            now.getTime() &&
                        new Date(activity.endTime).getTime() > now.getTime()
                )
                .map((activity: Activity) => ({
                    name: activity.name,
                    roomName: room.name,
                    startTime: activity.startTime,
                    endTime: activity.endTime,
                    timezone: venue.timezone,
                    key: `${room.id}-${activity.id}`,
                }))
        )
    );

/** What delegates are told when a room's groups change (SPEC-012) */
export interface TutorialNoticeSocketData {
    kind: "stillOn" | "endedByGroupStart";
    espId: number | null;
    deviceName: string;
}

export const tutorialNoticeText = (notice: TutorialNoticeSocketData) =>
    notice.kind === "stillOn"
        ? {
              title: `${notice.deviceName} is still in tutorial mode`,
              body: "A group started. Its solves aren't saved until the tutorial ends.",
          }
        : {
              title: `Tutorial on ${notice.deviceName} ended`,
              body: "The first group of the day started, so its solves are saved again.",
          };

/**
 * A browser notification, shown by the service worker on phones, like the
 * one for a new incident. Tagged per station and notice, so a second open
 * tab doesn't show it twice
 */
export const showTutorialNotice = (
    notice: TutorialNoticeSocketData,
    onClick: () => void
) => {
    if (!isNotificationsSupported()) return;
    const { title, body } = tutorialNoticeText(notice);
    const tag = `tutorialNotice-${notice.kind}-${notice.espId}`;
    void Notification.requestPermission().then((permission) => {
        if (permission !== "granted") return;
        showBrowserNotification({ title, body, tag, onClick });
    });
};
