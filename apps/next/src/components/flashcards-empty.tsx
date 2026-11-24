import { Card, type ResponsiveValue, VStack } from "@chakra-ui/react";

import { GhostMessage } from "./ghost-message";

export interface FlashcardsEmptyProps {
  h?: ResponsiveValue<string>;
}

export const FlashcardsEmpty: React.FC<FlashcardsEmptyProps> = ({
  h = { base: "340px", md: "500px" },
}) => {
  return (
    <Card
      w="full"
      h={h}
      rounded="xl"
      shadow="xl"
      overflow="hidden"
      p="8"
      alignItems="center"
      justifyContent="center"
      display="flex"
    >
      <VStack w="full">
        <GhostMessage message="No terms yet" />
      </VStack>
    </Card>
  );
};
