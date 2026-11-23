import React from "react";
import { Button, HStack, Text, Stack } from "@chakra-ui/react";

export interface AnkiRatingBarProps {
  estimates: {
    again: string;
    hard: string;
    good: string;
    easy: string;
  };
  onRate: (rating: 1 | 2 | 3 | 4) => void;
  isLoading?: boolean;
}

export const AnkiRatingBar: React.FC<AnkiRatingBarProps> = ({
  estimates,
  onRate,
  isLoading = false,
}) => {
  return (
    <HStack spacing={{ base: 2, md: 4 }} w="full" justify="center">
      {/* 1: Again */}
      <Button
        flex="1"
        maxW="140px"
        h="60px"
        colorScheme="red"
        variant="outline"
        bg="red.50"
        borderWidth="1px"
        borderColor="red.300"
        _dark={{ bg: "red.900", borderColor: "red.700" }}
        onClick={() => onRate(1)}
        isDisabled={isLoading}
      >
        <Stack spacing={0} align="center">
          <Text fontSize="xs" fontWeight={600} opacity={0.8}>
            {estimates.again}
          </Text>
          <Text fontWeight={700}>Again (1)</Text>
        </Stack>
      </Button>

      {/* 2: Hard */}
      <Button
        flex="1"
        maxW="140px"
        h="60px"
        colorScheme="yellow"
        variant="outline"
        bg="yellow.50"
        borderWidth="1px"
        borderColor="yellow.400"
        _dark={{ bg: "yellow.900", borderColor: "yellow.600" }}
        onClick={() => onRate(2)}
        isDisabled={isLoading}
      >
        <Stack spacing={0} align="center">
          <Text fontSize="xs" fontWeight={600} opacity={0.8}>
            {estimates.hard}
          </Text>
          <Text fontWeight={700}>Hard (2)</Text>
        </Stack>
      </Button>

      {/* 3: Good */}
      <Button
        flex="1"
        maxW="140px"
        h="60px"
        colorScheme="blue"
        variant="outline"
        bg="blue.50"
        borderWidth="1px"
        borderColor="blue.300"
        _dark={{ bg: "blue.900", borderColor: "blue.700" }}
        onClick={() => onRate(3)}
        isDisabled={isLoading}
      >
        <Stack spacing={0} align="center">
          <Text fontSize="xs" fontWeight={600} opacity={0.8}>
            {estimates.good}
          </Text>
          <Text fontWeight={700}>Good (3)</Text>
        </Stack>
      </Button>

      {/* 4: Easy */}
      <Button
        flex="1"
        maxW="140px"
        h="60px"
        colorScheme="green"
        variant="outline"
        bg="green.50"
        borderWidth="1px"
        borderColor="green.300"
        _dark={{ bg: "green.900", borderColor: "green.700" }}
        onClick={() => onRate(4)}
        isDisabled={isLoading}
      >
        <Stack spacing={0} align="center">
          <Text fontSize="xs" fontWeight={600} opacity={0.8}>
            {estimates.easy}
          </Text>
          <Text fontWeight={700}>Easy (4)</Text>
        </Stack>
      </Button>
    </HStack>
  );
};

export default AnkiRatingBar;
