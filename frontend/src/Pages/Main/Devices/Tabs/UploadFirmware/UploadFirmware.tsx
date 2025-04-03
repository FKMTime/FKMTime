import { FolderCode } from "lucide-react";
import { useState } from "react";

import { Button } from "@/Components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { Input } from "@/Components/ui/input";
import { useToast } from "@/hooks/useToast";
import { uploadFirmware } from "@/lib/devices";
import PageTransition from "@/Pages/PageTransition";

const UploadFirmware = () => {
    const { toast } = useToast();
    const [fileBase64, setFileBase64] = useState<string | null>(null);
    const [fileName, setFileName] = useState<string>("");

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
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
            toast({
                title: "Success",
                description: "Firmware uploaded successfully",
                variant: "success",
            });
        } else {
            toast({
                title: "Error",
                description: "Something went wrong",
                variant: "destructive",
            });
        }
    };

    return (
        <PageTransition>
            <Card>
                <CardHeader>
                    <CardTitle className="flex gap-2 items-center">
                        <FolderCode size={20} />
                        Upload Firmware
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="w-fit flex flex-col gap-3">
                        <label htmlFor="file-upload">Upload Binary File</label>
                        <Input
                            id="file-upload"
                            type="file"
                            accept=".bin"
                            onChange={handleFileUpload}
                        />
                        <Button onClick={handleSubmit} disabled={!fileBase64}>
                            Submit
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </PageTransition>
    );
};

export default UploadFirmware;
