import {
    DndContext,
    DragEndEvent,
    DragOverlay,
    DragStartEvent,
    PointerSensor,
    useSensor,
    useSensors,
} from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    useSortable,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X } from "lucide-react";
import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
} from "react";

import { Badge } from "@/Components/ui/badge";
import { useToast } from "@/hooks/useToast";
import { reorderAttempts, setAttemptReplacement } from "@/lib/attempt";
import { Attempt, AttemptStatus, AttemptType, Result } from "@/lib/interfaces";
import { attemptWithPenaltyToString } from "@/lib/resultFormatters";

interface AttemptsReorderBoardProps {
    result: Result;
    standardAttempts: Attempt[];
    extraAttempts: Attempt[];
    fetchData: () => void;
}

// ── Shared card class helpers ──────────────────────────────────────────────────

const cardBase =
    "flex items-center gap-1.5 rounded-md border px-2 py-1.5 bg-card text-xs transition-all select-none";

// ── Sortable standard-attempt card ────────────────────────────────────────────

interface SortableCardProps {
    attempt: Attempt;
    isOver: boolean;
    draggedExtraNumber: number | null;
    onClearReplacement: (attempt: Attempt) => void;
    cardRef?: React.RefObject<HTMLDivElement>;
}

const SortableAttemptCard = ({
    attempt,
    isOver,
    draggedExtraNumber,
    onClearReplacement,
    cardRef,
}: SortableCardProps) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: attempt.id, data: { type: "standard" } });

    const style = { transform: CSS.Transform.toString(transform), transition };
    const isExtraGiven = attempt.status === AttemptStatus.EXTRA_GIVEN;

    return (
        <div
            ref={(node) => {
                setNodeRef(node);
                if (cardRef)
                    (cardRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
            }}
            style={style}
            className={[
                cardBase,
                isDragging ? "opacity-40" : "",
                isOver && draggedExtraNumber !== null
                    ? "ring-2 ring-primary border-primary"
                    : "",
            ].join(" ")}
        >
            <span
                {...attributes}
                {...listeners}
                className="cursor-grab touch-none text-muted-foreground shrink-0"
            >
                <GripVertical size={13} />
            </span>
            <span className="w-4 shrink-0 text-muted-foreground font-mono">
                {attempt.attemptNumber}
            </span>
            <span className="flex-1 font-medium">
                {attempt.status === AttemptStatus.SCRAMBLED
                    ? "—"
                    : attemptWithPenaltyToString(attempt)}
            </span>
            {isExtraGiven && attempt.replacedBy !== null && (
                <div className="flex items-center gap-0.5">
                    <Badge variant="secondary" className="text-xs px-1 py-0">
                        →E{attempt.replacedBy}
                    </Badge>
                    <button
                        className="text-muted-foreground hover:text-destructive transition-colors"
                        onClick={() => onClearReplacement(attempt)}
                        title="Remove extra assignment"
                    >
                        <X size={11} />
                    </button>
                </div>
            )}
            {isOver && draggedExtraNumber !== null && (
                <Badge className="text-xs px-1 py-0 animate-pulse">
                    →E{draggedExtraNumber}
                </Badge>
            )}
        </div>
    );
};

// ── Draggable extra-attempt card ───────────────────────────────────────────────

interface ExtraCardProps {
    attempt: Attempt;
    isActive: boolean;
    cardRef?: React.RefObject<HTMLDivElement>;
    onClearReplacement: (attempt: Attempt) => void;
}

const ExtraAttemptCard = ({
    attempt,
    isActive,
    cardRef,
    onClearReplacement,
}: ExtraCardProps) => {
    const { attributes, listeners, setNodeRef, isDragging } = useSortable({
        id: attempt.id,
        data: { type: "extra" },
    });

    const isExtraGiven = attempt.status === AttemptStatus.EXTRA_GIVEN;

    return (
        <div
            ref={(node) => {
                setNodeRef(node);
                if (cardRef)
                    (
                        cardRef as React.MutableRefObject<HTMLDivElement | null>
                    ).current = node;
            }}
            className={[
                cardBase,
                isDragging ? "opacity-40" : "",
                isActive ? "ring-2 ring-primary border-primary" : "",
            ].join(" ")}
        >
            <span
                {...attributes}
                {...listeners}
                className="cursor-grab touch-none text-muted-foreground shrink-0"
                title="Drag onto an attempt to assign as replacement"
            >
                <GripVertical size={13} />
            </span>
            <span className="w-5 shrink-0 text-muted-foreground font-mono">
                E{attempt.attemptNumber}
            </span>
            <span className="flex-1 font-medium">
                {attemptWithPenaltyToString(attempt)}
            </span>
            {isExtraGiven && attempt.replacedBy !== null && (
                <div className="flex items-center gap-0.5">
                    <Badge variant="secondary" className="text-xs px-1 py-0">
                        →E{attempt.replacedBy}
                    </Badge>
                    <button
                        className="text-muted-foreground hover:text-destructive transition-colors"
                        onClick={() => onClearReplacement(attempt)}
                        title="Remove extra assignment"
                    >
                        <X size={11} />
                    </button>
                </div>
            )}
        </div>
    );
};

// ── SVG arrows ────────────────────────────────────────────────────────────────

interface Arrow {
    fromId: string;
    toId: string;
    extraNumber: number;
    fromType: "standard" | "extra";
}

interface ArrowLayerProps {
    arrows: Arrow[];
    cardRefs: Map<string, React.RefObject<HTMLDivElement>>;
    containerRef: React.RefObject<HTMLDivElement>;
}

const ArrowLayer = ({ arrows, cardRefs, containerRef }: ArrowLayerProps) => {
    const [paths, setPaths] = useState<{ d: string; key: string }[]>([]);

    const measure = useCallback(() => {
        if (!containerRef.current) return;
        const containerRect = containerRef.current.getBoundingClientRect();
        const newPaths: { d: string; key: string }[] = [];

        for (const arrow of arrows) {
            const fromRef = cardRefs.get(arrow.fromId);
            const toRef = cardRefs.get(arrow.toId);
            if (!fromRef?.current || !toRef?.current) continue;

            const from = fromRef.current.getBoundingClientRect();
            const to = toRef.current.getBoundingClientRect();

            let d: string;
            if (arrow.fromType === "extra") {
                // Route outside the right edge of the column so the curve doesn't
                // pass through any intermediate extra cards sitting between source and target.
                const x1 = from.right - containerRect.left;
                const y1 = from.top + from.height / 2 - containerRect.top;
                const x2 = to.right - containerRect.left;
                const y2 = to.top + to.height / 2 - containerRect.top;
                const bow = 16;
                d = `M ${x1} ${y1} C ${x1 + bow} ${y1}, ${x2 + bow} ${y2}, ${x2} ${y2}`;
            } else {
                // Horizontal bezier from right of standard to left of extra
                const x1 = from.right - containerRect.left;
                const y1 = from.top + from.height / 2 - containerRect.top;
                const x2 = to.left - containerRect.left;
                const y2 = to.top + to.height / 2 - containerRect.top;
                const cx = (x1 + x2) / 2;
                d = `M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`;
            }

            newPaths.push({ key: `${arrow.fromId}-${arrow.toId}`, d });
        }

        // Functional updater: return prev when paths haven't changed so React
        // bails out and does not schedule another render (breaks the loop).
        setPaths((prev) => {
            if (
                prev.length === newPaths.length &&
                prev.every(
                    (p, i) => p.d === newPaths[i].d && p.key === newPaths[i].key
                )
            ) {
                return prev;
            }
            return newPaths;
        });
    }, [arrows, cardRefs, containerRef]);

    useLayoutEffect(() => {
        measure();
    }, [measure]);

    useEffect(() => {
        window.addEventListener("resize", measure);
        return () => window.removeEventListener("resize", measure);
    }, [measure]);

    if (paths.length === 0) return null;

    return (
        <svg
            className="pointer-events-none absolute inset-0 overflow-visible"
            style={{ zIndex: 0 }}
        >
            <defs>
                <marker
                    id="arrowhead"
                    markerWidth="8"
                    markerHeight="8"
                    refX="6"
                    refY="3"
                    orient="auto"
                >
                    <path d="M0,0 L0,6 L8,3 z" className="fill-primary" />
                </marker>
            </defs>
            {paths.map(({ d, key }) => (
                <path
                    key={key}
                    d={d}
                    fill="none"
                    className="stroke-primary"
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                    markerEnd="url(#arrowhead)"
                />
            ))}
        </svg>
    );
};

// ── Main board ─────────────────────────────────────────────────────────────────

const AttemptsReorderBoard = ({
    result,
    standardAttempts: initialStandard,
    extraAttempts,
    fetchData,
}: AttemptsReorderBoardProps) => {
    const { toast } = useToast();
    const [standard, setStandard] = useState<Attempt[]>(initialStandard);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [overId, setOverId] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // refs for SVG arrows
    const cardRefs = useRef(new Map<string, React.RefObject<HTMLDivElement>>());
    const getCardRef = (id: string) => {
        if (!cardRefs.current.has(id)) {
            cardRefs.current.set(id, {
                current: null,
            } as React.RefObject<HTMLDivElement>);
        }
        return cardRefs.current.get(id)!;
    };

    useEffect(() => {
        setStandard(initialStandard);
    }, [initialStandard]);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
    );

    const activeAttempt = activeId
        ? [...standard, ...extraAttempts].find((a) => a.id === activeId)
        : null;

    const isDraggingExtra = activeAttempt?.type === AttemptType.EXTRA_ATTEMPT;
    const draggedExtraNumber = isDraggingExtra
        ? activeAttempt.attemptNumber
        : null;

    const handleDragStart = ({ active }: DragStartEvent) => {
        setActiveId(active.id as string);
    };

    const handleDragOver = ({ over }: { over: { id: string } | null }) => {
        setOverId(over ? (over.id as string) : null);
    };

    const handleDragEnd = async ({ active, over }: DragEndEvent) => {
        setActiveId(null);
        setOverId(null);
        if (!over || active.id === over.id) return;

        const activeData = active.data.current as { type: string } | undefined;

        if (activeData?.type === "standard") {
            // Reorder standard attempts
            const oldIndex = standard.findIndex((a) => a.id === active.id);
            const newIndex = standard.findIndex((a) => a.id === over.id);
            if (oldIndex === -1 || newIndex === -1) return;
            const reordered = arrayMove(standard, oldIndex, newIndex);
            setStandard(reordered);
            const status = await reorderAttempts(
                reordered.map((a) => a.id),
                result.id
            );
            if (status !== 200) {
                setStandard(initialStandard);
                toast({
                    title: "Error reordering attempts",
                    variant: "destructive",
                });
            } else {
                toast({ title: "Attempts reordered", variant: "success" });
                fetchData();
            }
            return;
        }

        if (activeData?.type === "extra") {
            // Assign extra to standard or extra attempt
            const targetId = over.id as string;
            const overData = over.data?.current as { type: string } | undefined;
            // Only allow dropping onto standard or extra attempts (not onto itself)
            if (
                !overData ||
                (overData.type !== "standard" && overData.type !== "extra")
            )
                return;
            if (active.id === targetId) return;

            const dragged = extraAttempts.find((a) => a.id === active.id);
            if (!dragged) return;

            const status = await setAttemptReplacement(
                targetId,
                dragged.attemptNumber
            );
            if (status !== 200) {
                toast({
                    title: "Error assigning extra",
                    variant: "destructive",
                });
            } else {
                toast({ title: "Extra assigned", variant: "success" });
                fetchData();
            }
        }
    };

    const handleClearReplacement = async (attempt: Attempt) => {
        const status = await setAttemptReplacement(attempt.id, null);
        if (status !== 200) {
            toast({
                title: "Error clearing replacement",
                variant: "destructive",
            });
        } else {
            fetchData();
        }
    };

    // Build arrows: from→to where "from" is the attempt being replaced,
    // "to" is the extra replacing it (found by extraNumber)
    const arrows: Arrow[] = [];
    const allAttempts = [...standard, ...extraAttempts];
    for (const a of allAttempts) {
        if (a.status === AttemptStatus.EXTRA_GIVEN && a.replacedBy != null) {
            const replacingExtra = extraAttempts.find(
                (e) => e.attemptNumber === a.replacedBy
            );
            if (replacingExtra) {
                arrows.push({
                    fromId: a.id,
                    toId: replacingExtra.id,
                    extraNumber: a.replacedBy!,
                    fromType: a.type === AttemptType.EXTRA_ATTEMPT ? "extra" : "standard",
                });
            }
        }
    }

    return (
        <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver as never}
            onDragEnd={handleDragEnd}
        >
            <div ref={containerRef} className="relative flex gap-8">
                {/* Standard attempts — sortable */}
                <div className="flex flex-col gap-2 flex-1 min-w-0">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                        Standard attempts
                    </p>
                    <SortableContext
                        items={standard.map((a) => a.id)}
                        strategy={verticalListSortingStrategy}
                    >
                        {standard.map((attempt) => (
                            <SortableAttemptCard
                                key={attempt.id}
                                attempt={attempt}
                                isOver={
                                    overId === attempt.id && isDraggingExtra
                                }
                                draggedExtraNumber={draggedExtraNumber}
                                onClearReplacement={handleClearReplacement}
                                cardRef={getCardRef(attempt.id)}
                            />
                        ))}
                    </SortableContext>
                </div>

                {/* Extra attempts — draggable onto standard */}
                {extraAttempts.length > 0 && (
                    <div className="flex flex-col gap-2 w-56 shrink-0">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                            Extra attempts
                            <span className="ml-1 font-normal normal-case">
                                (drag to assign)
                            </span>
                        </p>
                        <SortableContext
                            items={extraAttempts.map((a) => a.id)}
                            strategy={verticalListSortingStrategy}
                        >
                            {extraAttempts.map((attempt) => (
                                <ExtraAttemptCard
                                    key={attempt.id}
                                    attempt={attempt}
                                    isActive={activeId === attempt.id}
                                    cardRef={getCardRef(attempt.id)}
                                    onClearReplacement={handleClearReplacement}
                                />
                            ))}
                        </SortableContext>
                    </div>
                )}

                {/* SVG connection arrows */}
                <ArrowLayer
                    arrows={arrows}
                    cardRefs={cardRefs.current}
                    containerRef={containerRef}
                />
            </div>

            {/* Drag overlay — ghost card while dragging */}
            <DragOverlay>
                {activeAttempt && (
                    <div className="flex items-center gap-2 rounded-lg border px-3 py-2 bg-card text-sm shadow-lg opacity-90">
                        <GripVertical
                            size={16}
                            className="text-muted-foreground"
                        />
                        <span className="font-mono text-muted-foreground text-xs">
                            {activeAttempt.type === AttemptType.EXTRA_ATTEMPT
                                ? `E${activeAttempt.attemptNumber}`
                                : activeAttempt.attemptNumber}
                        </span>
                        <span className="font-medium">
                            {attemptWithPenaltyToString(activeAttempt)}
                        </span>
                    </div>
                )}
            </DragOverlay>
        </DndContext>
    );
};

export default AttemptsReorderBoard;
