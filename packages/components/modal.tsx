import {
  Divider as ChakraDivider,
  Heading as ChakraHeading,
  Modal as ChakraModal,
  ModalBody as ChakraModalBody,
  ModalCloseButton as ChakraModalCloseButton,
  ModalContent as ChakraModalContent,
  ModalFooter as ChakraModalFooter,
  ModalOverlay as ChakraModalOverlay,
  type ComponentWithAs,
  type HeadingProps,
  type ModalCloseButtonProps,
  type ModalContentProps,
  type ModalProps,
  Stack,
  type StackProps,
  forwardRef,
  useColorModeValue,
} from "@chakra-ui/react";

const Content = forwardRef<ModalContentProps, "div">(
  ({ children, ...props }) => {
    const modalBg = useColorModeValue(
      "rgba(255, 255, 255, 0.88)",
      "rgba(23, 25, 35, 0.86)",
    );
    const borderColor = useColorModeValue("gray.200", "gray.750");

    return (
      <ChakraModalContent
        rounded="2xl"
        bg={modalBg}
        backdropFilter="blur(16px)"
        borderWidth="2px"
        borderColor={borderColor}
        shadow="2xl"
        {...props}
      >
        {children}
      </ChakraModalContent>
    );
  },
);

const Body = forwardRef<StackProps, "div">(({ children, ...props }) => {
  return (
    <ChakraModalBody py="8" px="10">
      <Stack spacing="6" {...props}>
        {children}
      </Stack>
    </ChakraModalBody>
  );
});

const Heading = forwardRef<HeadingProps, "h1">(({ children, ...props }) => {
  return (
    <ChakraHeading size="lg" {...props}>
      {children}
    </ChakraHeading>
  );
});

const Divider = function ModalDivider() {
  const dividerColor = useColorModeValue("gray.200", "gray.750");

  return <ChakraDivider borderColor={dividerColor} borderBottomWidth="2px" />;
};

const BodySeparator = function ModalBodySeparator() {
  const dividerColor = useColorModeValue("gray.200", "gray.750");

  return (
    <ChakraDivider
      borderColor={dividerColor}
      borderBottomWidth="2px"
      w="calc(100% + 80px)"
      ml="-40px"
    />
  );
};

const Footer = function ModalFooter({
  children,
}: {
  children?: JSX.Element | JSX.Element[];
}) {
  return (
    <ChakraModalFooter px="10" py="6">
      {children}
    </ChakraModalFooter>
  );
};

const CloseButton = forwardRef<ModalCloseButtonProps, "button">((props) => {
  return <ChakraModalCloseButton rounded="full" top={4} right={4} {...props} />;
});

export const Modal = forwardRef<ModalProps, "div">(
  ({ isOpen, onClose, children, ...props }) => {
    return (
      <ChakraModal
        isOpen={isOpen}
        onClose={onClose}
        size="xl"
        isCentered
        {...props}
      >
        {children}
      </ChakraModal>
    );
  },
) as ComponentWithAs<"div", ModalProps> & {
  Overlay: typeof Overlay;
  Content: typeof Content;
  Body: typeof Body;
  Heading: typeof Heading;
  Divider: typeof Divider;
  BodySeparator: typeof BodySeparator;
  Footer: typeof Footer;
  CloseButton: typeof CloseButton;
};

const Overlay = function ModalOverlay() {
  const background = useColorModeValue(
    "rgba(247, 250, 252, 0.72)",
    "rgba(23, 25, 35, 0.55)",
  );

  return (
    <ChakraModalOverlay
      backdropFilter="blur(12px)"
      background={background}
      transform="translateZ(0px)"
    />
  );
};

Modal.Overlay = Overlay;
Modal.Content = Content;
Modal.Body = Body;
Modal.Heading = Heading;
Modal.Divider = Divider;
Modal.BodySeparator = BodySeparator;
Modal.Footer = Footer;
Modal.CloseButton = CloseButton;
