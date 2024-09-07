import { Box, DarkMode, FormControl, FormLabel, Input } from "@chakra-ui/react";
import {
    AutoComplete,
    AutoCompleteInput,
    AutoCompleteItem,
    AutoCompleteList,
} from "@choc-ui/chakra-autocomplete";

import Select from "@/Components/Select";
import { AddPerson } from "@/logic/interfaces";
import regions from "@/logic/regions";

interface PersonFormProps {
    canCompete?: boolean;
    isLoading: boolean;
    newPersonData: AddPerson;
    setNewPersonData: (data: AddPerson) => void;
}

const PersonForm = ({
    canCompete = false,
    isLoading,
    newPersonData,
    setNewPersonData,
}: PersonFormProps) => {
    const countries = regions.filter(
        (region) =>
            !["_Multiple Continents", "Continent"].includes(region.continentId)
    );

    return (
        <Box display="flex" gap="5" flexDirection="column">
            <FormControl isRequired>
                <FormLabel>Name</FormLabel>
                <Input
                    placeholder="Name"
                    disabled={isLoading}
                    value={newPersonData.name}
                    _placeholder={{ color: "white" }}
                    onChange={(event) =>
                        setNewPersonData({
                            ...newPersonData,
                            name: event.target.value,
                        })
                    }
                />
            </FormControl>
            <FormControl isRequired>
                <FormLabel>Gender</FormLabel>
                <Select
                    value={newPersonData.gender}
                    onChange={(e) =>
                        setNewPersonData({
                            ...newPersonData,
                            gender: e.target.value,
                        })
                    }
                    placeholder="Select gender"
                    disabled={isLoading}
                >
                    <option value="m">Male</option>
                    <option value="f">Female</option>
                    <option value="o">Other</option>
                </Select>
            </FormControl>
            {canCompete && (
                <>
                    <FormControl>
                        <FormLabel>WCA ID</FormLabel>
                        <Input
                            placeholder="WCA ID"
                            disabled={isLoading}
                            value={newPersonData.wcaId}
                            _placeholder={{ color: "white" }}
                            onChange={(event) =>
                                setNewPersonData({
                                    ...newPersonData,
                                    wcaId: event.target.value,
                                })
                            }
                        />
                    </FormControl>
                    <FormControl isRequired>
                        <FormLabel>Country</FormLabel>
                        <DarkMode>
                            <AutoComplete
                                openOnFocus
                                onChange={(value: string) =>
                                    setNewPersonData({
                                        ...newPersonData,
                                        countryIso2: value,
                                    })
                                }
                                value={newPersonData.countryIso2}
                                isLoading={isLoading}
                            >
                                <AutoCompleteInput
                                    autoFocus
                                    autoComplete="off"
                                    placeholder="Search for a country"
                                    _placeholder={{
                                        color: "gray.200",
                                    }}
                                    disabled={isLoading}
                                    borderColor="white"
                                />
                                <AutoCompleteList>
                                    {countries.map((region) => (
                                        <AutoCompleteItem
                                            key={region.iso2}
                                            value={region.iso2}
                                            label={region.name}
                                        >
                                            {region.name}
                                        </AutoCompleteItem>
                                    ))}
                                </AutoCompleteList>
                            </AutoComplete>
                        </DarkMode>
                    </FormControl>
                </>
            )}
            <FormControl>
                <FormLabel>Card</FormLabel>
                <Input
                    placeholder="Scan card"
                    disabled={isLoading}
                    value={newPersonData.cardId}
                    _placeholder={{ color: "white" }}
                    onChange={(event) =>
                        setNewPersonData({
                            ...newPersonData,
                            cardId: event.target.value,
                        })
                    }
                />
            </FormControl>
        </Box>
    );
};

export default PersonForm;
