import { Badge } from "@/Components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { StationExchange } from "@/lib/stationTester";

const JsonBlock = ({ label, value }: { label: string; value: unknown }) => (
    <section className="flex flex-col gap-1.5">
        <h3 className="text-xs font-semibold text-faint">{label}</h3>
        <pre
            aria-label={label}
            className="max-h-[420px] overflow-auto rounded-chip border bg-background px-3.5 py-3 font-mono text-xs leading-relaxed"
        >
            {JSON.stringify(value, null, 2)}
        </pre>
    </section>
);

interface ExchangePanelProps {
    exchange: StationExchange | null;
    isSending: boolean;
}

/** Only ever shows the latest send: it empties as soon as a new one starts */
const ExchangePanel = ({ exchange, isSending }: ExchangePanelProps) => {
    return (
        <Card>
            <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Reply</CardTitle>
                {exchange && (
                    <Badge
                        variant={exchange.failed ? "destructive" : "success"}
                    >
                        {exchange.failed ? "Refused" : "Accepted"}
                    </Badge>
                )}
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                {exchange ? (
                    <>
                        <JsonBlock label="Raw reply" value={exchange.reply} />
                        <JsonBlock label="Packet sent" value={exchange.sent} />
                    </>
                ) : (
                    <p className="text-sm text-muted-foreground">
                        {isSending
                            ? "Waiting for the reply..."
                            : "Send something to see the reply here."}
                    </p>
                )}
            </CardContent>
        </Card>
    );
};

export default ExchangePanel;
