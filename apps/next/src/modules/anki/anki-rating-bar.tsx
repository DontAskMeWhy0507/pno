import React from "react";
import { Box, Button, HStack, Stack, Text } from "@chakra-ui/react";

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
  const buttons: Array<{
    rating: 1 | 2 | 3 | 4;
    label: string;
    estimate: string;
    colorScheme: string;
    bg: string;
    borderColor: string;
    darkBg: string;
    darkBorderColor: string;
  }> = [
    {
      rating: 1,
      label: "Again",
      estimate: estimates.again,
      colorScheme: "red",
      bg: "red.50",
      borderColor: "red.300",
      darkBg: "red.900",
      darkBorderColor: "red.700",
    },
    {
      rating: 2,
      label: "Hard",
      estimate: estimates.hard,
      colorScheme: "yellow",
      bg: "yellow.50",
      borderColor: "yellow.400",
      darkBg: "yellow.900",
      darkBorderColor: "yellow.600",
    },
    {
      rating: 3,
      label: "Good",
      estimate: estimates.good,
      colorScheme: "blue",
      bg: "blue.50",
      borderColor: "blue.300",
      darkBg: "blue.900",
      darkBorderColor: "blue.700",
    },
    {
      rating: 4,
      label: "Easy",
      estimate: estimates.easy,
      colorScheme: "green",
      bg: "green.50",
      borderColor: "green.300",
      darkBg: "green.900",
      darkBorderColor: "green.700",
    },
  ];

  return (
    <HStack spacing={{ base: 1.5, sm: 3, md: 4 }} w="full" justify="center">
      {buttons.map((b) => (
        <Button
          key={b.rating}
          flex="1"
          minW={0}
          maxW="140px"
          h={{ base: "56px", md: "60px" }}
          px={{ base: 1, sm: 3 }}
          rounded="xl"
          colorScheme={b.colorScheme}
          variant="outline"
          bg={b.bg}
          borderWidth="1.5px"
          borderColor={b.borderColor}
          _dark={{ bg: b.darkBg, borderColor: b.darkBorderColor }}
          onClick={() => onRate(b.rating)}
          isDisabled={isLoading}
        >
          <Stack spacing={0} align="center" minW={0}>
            <Text
              fontSize={{ base: "2xs", sm: "xs" }}
              fontWeight={600}
              opacity={0.8}
              noOfLines={1}
            >
              {b.estimate}
            </Text>
            <Text
              fontSize={{ base: "xs", sm: "sm", md: "md" }}
              fontWeight={700}
              noOfLines={1}
            >
              {b.label}
              <Box as="span" display={{ base: "none", sm: "inline" }}>
                {" "}
                ({b.rating})
              </Box>
            </Text>
          </Stack>
        </Button>
      ))}
    </HStack>
  );
};

export default AnkiRatingBar;
