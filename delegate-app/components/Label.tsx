import { Text } from "./Themed";

interface LabelProps {
    text: string;
}

const Label: React.FC<LabelProps> = ({text}): JSX.Element => {
  return <Text className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">{text}</Text>
};

export default Label;
