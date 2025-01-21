import {
    Tooltip as ShadcnTooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "./ui/tooltip";

interface Tooltip {
    children: React.ReactNode;
    content: string;
}

const Tooltip = ({ children, content }: Tooltip) => {
    return (
        <TooltipProvider>
            <ShadcnTooltip>
                <TooltipTrigger>{children}</TooltipTrigger>
                <TooltipContent>
                    <p>{content}</p>
                </TooltipContent>
            </ShadcnTooltip>
        </TooltipProvider>
    );
};

export default Tooltip;
