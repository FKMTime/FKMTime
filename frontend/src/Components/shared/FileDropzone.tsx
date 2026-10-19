import { FileUp } from "lucide-react";
import { useId, useState } from "react";

import { cn } from "@/lib/utils";

interface FileDropzoneProps {
    title: string;
    description?: string;
    accept: string;
    onFileChange: (file: File | null) => void;
    className?: string;
}

/** Dashed drop area that doubles as a file picker */
const FileDropzone = ({
    title,
    description,
    accept,
    onFileChange,
    className,
}: FileDropzoneProps) => {
    const id = useId();
    const [fileName, setFileName] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    const select = (file: File | null) => {
        setFileName(file?.name ?? null);
        onFileChange(file);
    };

    return (
        <label
            htmlFor={id}
            onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(event) => {
                event.preventDefault();
                setIsDragging(false);
                select(event.dataTransfer.files?.[0] ?? null);
            }}
            className={cn(
                "flex cursor-pointer flex-col items-center gap-2.5 rounded-mobile-card border-[1.5px] border-dashed border-border-strong bg-card px-5 py-12 text-center transition-colors hover:bg-accent/50 md:rounded-2xl",
                isDragging && "border-primary bg-primary-soft",
                className
            )}
        >
            <FileUp aria-hidden className="size-9 text-faint" />
            <span className="text-[15px] font-semibold">
                {fileName ?? title}
            </span>
            {description && (
                <span className="text-[13px] text-muted-foreground">
                    {description}
                </span>
            )}
            <input
                id={id}
                type="file"
                accept={accept}
                className="sr-only"
                onChange={(event) => select(event.target.files?.[0] ?? null)}
            />
        </label>
    );
};

export default FileDropzone;
