import React from "react";

import { Box } from "@chakra-ui/react";

import { Footer } from "./footer";

export const WithFooter: React.FC<React.PropsWithChildren> = ({ children }) => {
  return (
    <Box display="flex" flexDir="column">
      <Box
        minH="calc(100dvh - 80px)"
        pt={{ base: "20px", md: "40px" }}
        pb={{ base: "64px", md: "120px" }}
      >
        {children}
      </Box>
      <Footer />
    </Box>
  );
};
