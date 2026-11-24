import { theme } from "@pno/lib/chakra-theme";

import { ChakraProvider } from "@chakra-ui/provider";

import { ErrorFallback } from "../components/error-boundary";

export default function Custom500() {
  return (
    <ChakraProvider theme={theme}>
      <ErrorFallback
        title="500"
        description="Something went wrong on our end. Please try reloading the page."
      />
    </ChakraProvider>
  );
}
