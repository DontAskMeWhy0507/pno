import Head from "next/head";
import React from "react";

import {
  Button,
  Center,
  HStack,
  Heading,
  Text,
  VStack,
} from "@chakra-ui/react";

export const ErrorFallback: React.FC<{
  title?: string;
  description?: string;
  onRetry?: () => void;
}> = ({
  title = "Oh Snap!",
  description = "An error occurred on this page that we couldn't handle.",
  onRetry,
}) => {
  return (
    <>
      <Head>
        <title>Error | PNO</title>
      </Head>
      <Center height="calc(100vh - 120px)" px="4">
        <VStack textAlign="center" spacing={6}>
          <Heading
            fontSize={{ base: "5xl", md: "7xl" }}
            bgGradient="linear(to-r, blue.300, purple.300)"
            bgClip="text"
          >
            {title}
          </Heading>
          <Text
            fontSize={{ base: "md", sm: "lg" }}
            color="gray.500"
            fontWeight={600}
            maxW="md"
          >
            {description}
          </Text>
          <HStack spacing={3}>
            <Button
              colorScheme="blue"
              onClick={() => {
                if (onRetry) {
                  onRetry();
                } else {
                  window.location.reload();
                }
              }}
            >
              Reload
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                window.location.href = "/";
              }}
            >
              Home
            </Button>
          </HStack>
        </VStack>
      </Center>
    </>
  );
};

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<
  React.PropsWithChildren,
  ErrorBoundaryState
> {
  constructor(props: React.PropsWithChildren) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("Unhandled UI error caught by ErrorBoundary:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorFallback
          onRetry={() => {
            this.setState({ hasError: false });
            window.location.reload();
          }}
        />
      );
    }

    return this.props.children;
  }
}
