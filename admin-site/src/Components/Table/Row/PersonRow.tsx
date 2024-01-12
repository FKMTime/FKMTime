import { Tr, Td, IconButton } from "@chakra-ui/react";
import { Person } from "../../../logic/interfaces";
import { FaAddressCard } from "react-icons/fa";
import { MdDone } from "react-icons/md";
import { prettyGender, regionNameByIso2 } from "../../../logic/utils";

interface PersonRowProps {
    person: Person;
    fetchData: () => void;
}

const PersonRow: React.FC<PersonRowProps> = ({ person }): JSX.Element => {

    //    const [isOpenAssignCardModal, setIsOpenEditPersonModal] = useState<boolean>(false);

    //     const handleCloseAssignCardModal = async () => {
    //         await fetchData();
    //         setIsOpenEditPersonModal(false);
    //     };

    return (
        <>
            <Tr key={person.id}>
                <Td>{person.registrantId}</Td>
                <Td>{person.name}</Td>
                <Td>{person.wcaId}</Td>
                <Td>{regionNameByIso2(person.countryIso2!)}</Td>
                <Td>{prettyGender(person.gender)}</Td>
                <Td>{person.cardId && <MdDone />}</Td>
                <Td>
                    <IconButton icon={<FaAddressCard />} aria-label="Delete" bg="none" color="white" _hover={{
                        background: "none",
                        color: "gray.400"
                    }}
                    // onClick={() => setIsOpenEditPersonModal(true)}
                    />
                </Td>
            </Tr>

        </>
    )
};

export default PersonRow;
