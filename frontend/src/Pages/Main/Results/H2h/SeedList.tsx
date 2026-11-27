import {
    closestCenter,
    DndContext,
    DragEndEvent,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Lock } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/Components/ui/badge";
import { Button } from "@/Components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/Components/ui/select";
import { useToast } from "@/hooks/useToast";
import { H2hBracket, H2hPerson, updateSeeds } from "@/lib/h2h";
import { cn } from "@/lib/utils";

interface SeedListProps {
    roundId: string;
    bracket: H2hBracket;
    /** Everyone who can be put in the bracket */
    candidates: H2hPerson[];
}

/** One place per seed: the person in it, or null while it's empty */
const seedsOf = (bracket: H2hBracket) =>
    Array.from(
        { length: bracket.size },
        (_, i) =>
            bracket.entrants.find((e) => e.seed === i + 1)?.person.id ?? null
    );

/** Sortable needs an id for empty places too */
const slotId = (personId: string | null, index: number) =>
    personId ?? `empty-${index}`;

interface SeedRowProps {
    index: number;
    personId: string | null;
    person: H2hPerson | undefined;
    tieBroken: boolean;
    locked: boolean;
    /** People who aren't in another place */
    choices: H2hPerson[];
    onPick: (personId: string) => void;
}

const SeedRow = ({
    index,
    personId,
    person,
    tieBroken,
    locked,
    choices,
    onPick,
}: SeedRowProps) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: slotId(personId, index), disabled: locked });
    return (
        <li
            ref={setNodeRef}
            style={{ transform: CSS.Transform.toString(transform), transition }}
            className={cn(
                "flex items-center gap-2 rounded-lg border bg-card px-2 py-1.5",
                isDragging && "opacity-40"
            )}
        >
            {locked ? (
                <Lock size={14} className="shrink-0 text-muted-foreground" />
            ) : (
                <button
                    type="button"
                    {...attributes}
                    {...listeners}
                    aria-label={`Move seed ${index + 1}`}
                    className="shrink-0 cursor-grab touch-none text-muted-foreground"
                >
                    <GripVertical size={16} />
                </button>
            )}
            <span className="w-6 shrink-0 text-right font-mono text-sm text-muted-foreground">
                {index + 1}
            </span>
            <Select
                value={personId ?? ""}
                onValueChange={onPick}
                disabled={locked}
            >
                <SelectTrigger
                    aria-label={`Competitor for seed ${index + 1}`}
                    className="h-9 min-w-0 flex-1 border-none shadow-none md:h-9"
                >
                    <SelectValue placeholder="Choose a competitor">
                        {person?.name}
                    </SelectValue>
                </SelectTrigger>
                <SelectContent>
                    {choices.map((choice) => (
                        <SelectItem key={choice.id} value={choice.id}>
                            {choice.name}
                            {choice.wcaId ? ` (${choice.wcaId})` : ""}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            {tieBroken && (
                <Badge variant="secondary">Tie broken randomly</Badge>
            )}
        </li>
    );
};

/**
 * The seeds in order: drag to reorder, pick to swap a competitor (I1c,
 * I1d). Locked once a match has started.
 */
const SeedList = ({ roundId, bracket, candidates }: SeedListProps) => {
    const { toast } = useToast();
    const saved = seedsOf(bracket);
    const [seeds, setSeeds] = useState(saved);
    const [loaded, setLoaded] = useState(bracket);
    if (bracket !== loaded) {
        setLoaded(bracket);
        setSeeds(saved);
    }
    const [isSaving, setIsSaving] = useState(false);
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );
    const people = new Map(
        [...candidates, ...bracket.entrants.map((e) => e.person)].map((p) => [
            p.id,
            p,
        ])
    );
    const isDirty = seeds.some((personId, i) => personId !== saved[i]);
    const filled = seeds.filter((personId) => personId !== null);
    // An empty place above a filled one
    const hasGap = seeds.some(
        (personId, i) =>
            personId === null && seeds.slice(i).some((p) => p !== null)
    );
    const locked = bracket.seedsLocked;

    const handleDragEnd = ({ active, over }: DragEndEvent) => {
        if (!over || active.id === over.id) return;
        const ids = seeds.map(slotId);
        const from = ids.indexOf(String(active.id));
        const to = ids.indexOf(String(over.id));
        if (from === -1 || to === -1) return;
        setSeeds(arrayMove(seeds, from, to));
    };

    const pick = (index: number, personId: string) =>
        setSeeds(seeds.map((p, i) => (i === index ? personId : p)));

    const handleSave = async () => {
        setIsSaving(true);
        const result = await updateSeeds(roundId, filled);
        setIsSaving(false);
        toast(
            result.ok
                ? { title: "Seeds saved", variant: "success" }
                : {
                      title: "Seeds not saved",
                      description: result.message,
                      variant: "destructive",
                  }
        );
    };

    return (
        <div className="flex flex-col gap-3">
            {locked && (
                <p className="text-sm text-muted-foreground">
                    A match has started, so the seeds can't change.
                </p>
            )}
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
            >
                <SortableContext
                    items={seeds.map(slotId)}
                    strategy={verticalListSortingStrategy}
                >
                    <ol className="flex flex-col gap-1.5" aria-label="Seeds">
                        {seeds.map((personId, index) => {
                            const entrant = bracket.entrants.find(
                                (e) => e.person.id === personId
                            );
                            return (
                                <SeedRow
                                    key={slotId(personId, index)}
                                    index={index}
                                    personId={personId}
                                    person={
                                        personId
                                            ? people.get(personId)
                                            : undefined
                                    }
                                    // Only while they keep the seed the draw gave
                                    tieBroken={
                                        !!entrant?.seedTieBroken &&
                                        entrant.seed === index + 1
                                    }
                                    locked={locked}
                                    choices={[...people.values()].filter(
                                        (p) =>
                                            p.id === personId ||
                                            !seeds.includes(p.id)
                                    )}
                                    onPick={(id) => pick(index, id)}
                                />
                            );
                        })}
                    </ol>
                </SortableContext>
            </DndContext>
            {hasGap && (
                <p role="alert" className="text-sm text-destructive">
                    Fill the seeds from the top, without gaps.
                </p>
            )}
            {isDirty && !locked && (
                <div className="flex gap-2">
                    <Button onClick={handleSave} disabled={isSaving || hasGap}>
                        Save seeds
                    </Button>
                    <Button variant="ghost" onClick={() => setSeeds(saved)}>
                        Undo changes
                    </Button>
                </div>
            )}
        </div>
    );
};

export default SeedList;
