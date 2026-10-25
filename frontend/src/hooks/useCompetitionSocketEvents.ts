import { useEffect, useRef } from "react";
import type { io } from "socket.io-client";

type AppSocket = ReturnType<typeof io>;

export interface NewIncidentSocketData {
    id: string;
    competitorName: string;
    deviceName: string;
}

interface CompetitionSocketHandlers {
    onNewIncident: (data: NewIncidentSocketData) => void;
    onGroupShouldBeChanged: (data: { message: string }) => void;
}

/**
 * Keeps a signed-in user in the incidents and competition rooms and listens
 * for their events.
 *
 * Rooms are joined on every (re)connect, because a new connection starts
 * outside them, and left only when the user changes or the shell unmounts.
 * Leaving and re-joining on re-renders raced on the server (both handlers
 * check the token asynchronously), which could leave the user outside the
 * room and miss incidents.
 */
export const useCompetitionSocketEvents = (
    socket: AppSocket,
    userId: string | undefined,
    connectionCount: number,
    handlers: CompetitionSocketHandlers
) => {
    // The latest handlers, so listeners are registered once per user rather
    // than on every render
    const handlersRef = useRef(handlers);
    handlersRef.current = handlers;

    useEffect(() => {
        if (!userId) return;
        const handleNewIncident = (data: NewIncidentSocketData) =>
            handlersRef.current.onNewIncident(data);
        const handleGroupShouldBeChanged = (data: { message: string }) =>
            handlersRef.current.onGroupShouldBeChanged(data);
        socket.on("newIncident", handleNewIncident);
        socket.on("groupShouldBeChanged", handleGroupShouldBeChanged);
        return () => {
            socket.off("newIncident", handleNewIncident);
            socket.off("groupShouldBeChanged", handleGroupShouldBeChanged);
            socket.emit("leaveIncidents");
            socket.emit("leaveCompetition");
        };
    }, [socket, userId]);

    useEffect(() => {
        if (!userId) return;
        socket.emit("joinIncidents");
        socket.emit("joinCompetition");
    }, [socket, userId, connectionCount]);
};
