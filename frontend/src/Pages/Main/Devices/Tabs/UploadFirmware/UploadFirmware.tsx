import { Upload } from "lucide-react";
import { useState } from "react";

import FileDropzone from "@/Components/shared/FileDropzone";
import { Button } from "@/Components/ui/button";
import { useToast } from "@/hooks/useToast";
import { uploadFirmware } from "@/lib/devices";

const UploadFirmware = () => {
    const { toast } = useToast();
    const [fileBase64, setFileBase64] = useState<string | null>(null);
    const [fileName, setFileName] = useState<string>("");

    const handleFileChange = (file: File | null) => {
        setFileBase64(null);
        if (file) {
            setFileName(file.name);
            const reader = new FileReader();
            reader.onload = () => {
                const base64String = (reader.result as string).split(",")[1];
                setFileBase64(base64String);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async () => {
        if (!fileBase64) {
            return toast({
                title: "Error",
                description: "No file selected",
                variant: "destructive",
            });
        }
        const status = await uploadFirmware(fileName, fileBase64);

        if (status === 200) {
            toast({ title: "Firmware uploaded", variant: "success" });
        } else {
            toast({
                title: "Error",
                description: "Something went wrong",
                variant: "destructive",
            });
        }
    };

    return (
        <div className="flex flex-col gap-3">
            <FileDropzone
                title="Upload binary file"
                description='Drop a .bin firmware file or click to choose. Devices update when "Update devices" is on.'
                accept=".bin"
                onFileChange={handleFileChange}
            />
            <Button
                onClick={handleSubmit}
                disabled={!fileBase64}
                className="w-full md:w-fit"
            >
                <Upload />
                Upload firmware
            </Button>
        </div>
    );
};

export default UploadFirmware;
