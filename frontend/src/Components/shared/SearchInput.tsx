import { Search } from "lucide-react";
import { ComponentProps } from "react";

import { Input } from "@/Components/ui/input";
import { cn } from "@/lib/utils";

type SearchInputProps = Omit<ComponentProps<typeof Input>, "type"> & {
    label?: string;
};

/**
 * Text input with a leading search icon. Autocorrect is off: searches are
 * for names and IDs, which iOS would otherwise "fix" while typing.
 */
const SearchInput = ({
    className,
    label = "Search",
    placeholder = "Search",
    ...props
}: SearchInputProps) => (
    <div className={cn("relative w-full md:max-w-sm", className)}>
        <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-faint"
        />
        <Input
            type="search"
            aria-label={label}
            placeholder={placeholder}
            className="pl-10"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            {...props}
        />
    </div>
);

export default SearchInput;
