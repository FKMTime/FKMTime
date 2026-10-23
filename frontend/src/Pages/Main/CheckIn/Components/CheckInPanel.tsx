import { Nfc, UserCheck } from "lucide-react";
import { FormEvent, useState } from "react";

import InlineError from "@/Components/shared/InlineError";
import { Button } from "@/Components/ui/button";
import { Checkbox } from "@/Components/ui/checkbox";
import { Input } from "@/Components/ui/input";
import { Label } from "@/Components/ui/label";
import { Person } from "@/lib/interfaces";
import { WCA_ORIGIN } from "@/lib/request";
import { getInitials, isNewcomer, regionNameByIso2 } from "@/lib/utils";

interface CheckInPanelProps {
    person: Person;
    error: string;
    isLoading: boolean;
    onCheckIn: (cardId: string) => void;
    onCancel: () => void;
}

/** The selected competitor: card to assign, newcomer checks, check-in */
const CheckInPanel = ({
    person,
    error,
    isLoading,
    onCheckIn,
    onCancel,
}: CheckInPanelProps) => {
    const [newCardId, setNewCardId] = useState("");
    const [checks, setChecks] = useState<Record<string, boolean>>({});
    const needsCard = !person.cardId;
    const cardId = person.cardId ?? newCardId.trim();

    const birthdate = person.birthdate
        ? new Date(person.birthdate).toISOString().split("T")[0]
        : null;
    const checklist = isNewcomer(person)
        ? [
              {
                  key: "name",
                  label: `I have checked the competitor's ID card and the name of the competitor is ${person.name}`,
              },
              ...(birthdate
                  ? [
                        {
                            key: "birthdate",
                            label: `I have checked the competitor's ID card and the date of birth is ${birthdate}`,
                        },
                    ]
                  : []),
              {
                  key: "newcomer",
                  label: "I have verbally confirmed that the competitor is a newcomer",
              },
              {
                  key: "citizenship",
                  label: `I have checked that the competitor is a citizen of ${regionNameByIso2(person.countryIso2 || "")}`,
              },
          ]
        : [];
    const canCheckIn =
        !!cardId && checklist.every((item) => checks[item.key]) && !isLoading;

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();
        if (canCheckIn) onCheckIn(cardId);
    };

    return (
        <form
            onSubmit={handleSubmit}
            aria-label={`Check in ${person.name}`}
            className="flex flex-col gap-4 rounded-mobile-card border bg-card p-4 md:rounded-2xl md:p-[22px] lg:sticky lg:top-[88px]"
        >
            <div className="flex items-center gap-3">
                <span
                    aria-hidden
                    className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary"
                >
                    {getInitials(person.name)}
                </span>
                <div className="min-w-0">
                    <h2 className="truncate text-lg font-bold">
                        {person.name}
                        {person.registrantId && (
                            <span className="font-normal text-muted-foreground">
                                {" "}
                                ({person.registrantId})
                            </span>
                        )}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        {person.countryIso2 &&
                            `${regionNameByIso2(person.countryIso2)} · `}
                        {person.wcaId ? (
                            <a
                                href={`${WCA_ORIGIN}/persons/${person.wcaId}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-primary hover:underline"
                            >
                                {person.wcaId}
                            </a>
                        ) : (
                            "Newcomer"
                        )}
                    </p>
                </div>
            </div>

            {needsCard && (
                <div className="flex flex-col gap-2 rounded-xl bg-primary-soft p-3.5">
                    <Label htmlFor="check-in-card" className="text-sm">
                        Scan a card to assign it to this competitor
                    </Label>
                    <div className="relative">
                        <Nfc
                            aria-hidden
                            className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-faint"
                        />
                        <Input
                            id="check-in-card"
                            autoFocus
                            value={newCardId}
                            onChange={(e) => setNewCardId(e.target.value)}
                            placeholder="Card ID"
                            className="bg-card pl-10"
                        />
                    </div>
                </div>
            )}

            {checklist.length > 0 && (
                <fieldset className="flex flex-col gap-1">
                    <legend className="mb-1 text-xs font-semibold text-faint">
                        Newcomer checks
                    </legend>
                    {checklist.map((item) => (
                        <Label
                            key={item.key}
                            className="flex min-h-11 cursor-pointer items-center gap-3 py-1 font-normal leading-snug md:min-h-9"
                        >
                            <Checkbox
                                checked={!!checks[item.key]}
                                onCheckedChange={(value) =>
                                    setChecks((current) => ({
                                        ...current,
                                        [item.key]: !!value,
                                    }))
                                }
                            />
                            {item.label}
                        </Label>
                    ))}
                </fieldset>
            )}

            <InlineError>{error}</InlineError>

            <div className="flex flex-col gap-2.5 sm:flex-row">
                <Button type="submit" disabled={!canCheckIn}>
                    <UserCheck />
                    {needsCard ? "Check in and assign card" : "Check in"}
                </Button>
                <Button type="button" variant="outline" onClick={onCancel}>
                    Cancel
                </Button>
            </div>
        </form>
    );
};

export default CheckInPanel;
