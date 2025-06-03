import { useNavigate } from "react-router-dom";

import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { useToast } from "@/hooks/useToast";
import { createManualIncident } from "@/lib/incidents";
import { ManualIncidentData } from "@/lib/interfaces";
import PageTransition from "@/Pages/PageTransition";

import ManualIncidentForm from "../Components/ManualIncidentForm";

const CreateManualIncident = () => {
    const { toast } = useToast();
    const navigate = useNavigate();

    const handleSubmit = async (data: ManualIncidentData) => {
        const status = await createManualIncident(data);
        if (status === 201) {
            toast({
                title: "Incident added",
                description: "The incident has been successfully added.",
                variant: "success",
            });
            navigate("/incidents/manual");
        } else {
            toast({
                title: "Error",
                description: "Failed to add the incident.",
                variant: "destructive",
            });
        }
    };

    return (
        <PageTransition>
            <div className="flex flex-col gap-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Add incident</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ManualIncidentForm
                            submitText="Add"
                            handleSubmit={handleSubmit}
                            isLoading={false}
                        />
                    </CardContent>
                </Card>
            </div>
        </PageTransition>
    );
};

export default CreateManualIncident;
