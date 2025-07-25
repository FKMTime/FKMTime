import { Save, ShieldAlert } from "lucide-react";
import { ChangeEvent, useEffect, useState } from "react";

import { Modal } from "@/Components/Modal";
import { Button } from "@/Components/ui/button";
import { Textarea } from "@/Components/ui/textarea";
import { useToast } from "@/hooks/useToast";
import { updateComment } from "@/lib/attendance";
import { StaffActivity } from "@/lib/interfaces";
import { isDelegate } from "@/lib/permissions";

import IssueWarningModal from "../../Persons/Components/IssueWarningModal";

interface DetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    staffActivity?: StaffActivity | null;
}

const DetailsModal = ({
    isOpen,
    onClose,
    staffActivity,
}: DetailsModalProps) => {
    const { toast } = useToast();
    const [comment, setComment] = useState<string>(
        staffActivity?.comment || ""
    );
    const [isOpenIssueWarningModal, setIsOpenIssueWarningModal] =
        useState<boolean>(false);

    const handleCommentChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
        setComment(event.target.value);
    };

    const handleSave = async () => {
        const status = await updateComment(staffActivity?.id || "", comment);
        if (status === 200) {
            toast({
                title: "Comment updated successfully",
                description: "Your comment has been saved.",
                variant: "success",
            });
            handleClose();
        } else {
            toast({
                title: "Something went wrong",
                description: "There was an error saving your comment.",
                variant: "destructive",
            });
        }
    };

    const handleClose = () => {
        setComment("");
        onClose();
    };

    useEffect(() => {
        if (isOpen && staffActivity) {
            setComment(staffActivity.comment || "");
        }
    }, [isOpen, staffActivity]);

    if (!staffActivity || !staffActivity.person) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            title={staffActivity?.person.name || "Details"}
        >
            <Textarea
                placeholder="Comment"
                value={comment}
                onChange={handleCommentChange}
            />
            <Button variant="success" onClick={handleSave}>
                <Save />
                Save
            </Button>
            {isDelegate() && (
                <>
                    <Button
                        variant="destructive"
                        onClick={() => setIsOpenIssueWarningModal(true)}
                    >
                        <ShieldAlert />
                        Issue a warning
                    </Button>
                    <IssueWarningModal
                        isOpen={isOpenIssueWarningModal}
                        onClose={() => {
                            setIsOpenIssueWarningModal(false);
                            handleClose();
                        }}
                        person={staffActivity?.person}
                    />
                </>
            )}
        </Modal>
    );
};

export default DetailsModal;
