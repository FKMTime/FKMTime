import { useEffect, useRef } from "react";
import type { io } from "socket.io-client";

import { OfficialResultsDestination } from "@/lib/interfaces";

type AppSocket = ReturnType<typeof io>;

export interface NewIncidentSocketData {
    id: string;
    competitorName: string;
    deviceName: string;
}

interface CompetitionSocketHandlers {
    onNewIncident: (data: NewIncidentSocketData) => void;
    onGroupShouldBeChanged: (data: { message: string }) => void;
    /** The WCA website now names another scoretaking tool */
    onScoretakingSoftwareChanged?: (data: {
        officialResultsDestination: OfficialResultsDestination;
    }) => void;
    /** The WCA live results connection was made, ended or broke */
    onIntegratedLiveConnectionChanged?: () => void;
    /** A round started but isn't open in WCA Integrated Live Results */
    onRoundShouldBeOpened?: (data: {
        roundId: string;
        blockers: string[];
    }) => void;
    /** A round was opened or closed there, or someone added to one */
    onIntegratedLiveRoundsChanged?: () => void;
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
    handlers: CompetitionSocketHandlers
) => {
    // The latest handlers, so listeners are registered once per user rather
    // than on every render
    const handlersRef = useRef(handlers);
    useEffect(() => {
        handlersRef.current = handlers;
    });

    useEffect(() => {
        if (!userId) return;
        const handleNewIncident = (data: NewIncidentSocketData) =>
            handlersRef.current.onNewIncident(data);
        const handleGroupShouldBeChanged = (data: { message: string }) =>
            handlersRef.current.onGroupShouldBeChanged(data);
        const handleScoretakingSoftwareChanged = (data: {
            officialResultsDestination: OfficialResultsDestination;
        }) => handlersRef.current.onScoretakingSoftwareChanged?.(data);
        const handleIntegratedLiveConnectionChanged = () =>
            handlersRef.current.onIntegratedLiveConnectionChanged?.();
        const handleRoundShouldBeOpened = (data: {
            roundId: string;
            blockers: string[];
        }) => handlersRef.current.onRoundShouldBeOpened?.(data);
        const handleIntegratedLiveRoundsChanged = () =>
            handlersRef.current.onIntegratedLiveRoundsChanged?.();
        socket.on("roundShouldBeOpened", handleRoundShouldBeOpened);
        socket.on(
            "integratedLiveRoundsChanged",
            handleIntegratedLiveRoundsChanged
        );
        socket.on("newIncident", handleNewIncident);
        socket.on(
            "integratedLiveConnectionChanged",
            handleIntegratedLiveConnectionChanged
        );
        socket.on("groupShouldBeChanged", handleGroupShouldBeChanged);
        socket.on(
            "scoretakingSoftwareChanged",
            handleScoretakingSoftwareChanged
        );
        return () => {
            socket.off("newIncident", handleNewIncident);
            socket.off("roundShouldBeOpened", handleRoundShouldBeOpened);
            socket.off(
                "integratedLiveRoundsChanged",
                handleIntegratedLiveRoundsChanged
            );
            socket.off(
                "integratedLiveConnectionChanged",
                handleIntegratedLiveConnectionChanged
            );
            socket.off("groupShouldBeChanged", handleGroupShouldBeChanged);
            socket.off(
                "scoretakingSoftwareChanged",
                handleScoretakingSoftwareChanged
            );
            socket.emit("leaveIncidents");
            socket.emit("leaveCompetition");
        };
    }, [socket, userId]);

    useEffect(() => {
        if (!userId) return;
        const join = () => {
            socket.emit("joinIncidents");
            socket.emit("joinCompetition");
        };
        // Emits sent while disconnected are buffered and replayed, which
        // would join twice: wait for the connect handler instead
        if (socket.connected) join();
        socket.on("connect", join);
        return () => {
            socket.off("connect", join);
        };
    }, [socket, userId]);
};
