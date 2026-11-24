import React from "react";

import { Modal } from "@pno/components/modal";
import { ToggleGroup } from "@pno/components/toggle-group";
import {
  getQuestionTypeIcon,
  getQuestionTypeName,
} from "@pno/components/utils";
import { TestQuestionType } from "@pno/interfaces";

import {
  Box,
  Button,
  Flex,
  GridItem,
  HStack,
  IconButton,
  SimpleGrid,
  Slider,
  SliderFilledTrack,
  SliderThumb,
  SliderTrack,
  Stack,
  Text,
  Tooltip,
  useColorModeValue,
} from "@chakra-ui/react";

import { IconX } from "@tabler/icons-react";

import { SelectAnswerMode } from "../../components/select-answer-mode";
import { useTestContext } from "../../stores/use-test-store";

export interface TestSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReset: () => void;
}

export const TestSettingsModal: React.FC<TestSettingsModalProps> = ({
  isOpen,
  onClose,
  onReset,
}) => {
  const startRef = React.useRef<HTMLButtonElement>(null);

  const liveSettings = useTestContext((s) => s.settings);
  const allTerms = useTestContext((s) => s.allTerms.length);
  const starredTerms = useTestContext((s) => s.starredTerms.length);
  const setSettings = useTestContext((s) => s.setSettings);

  const [draft, setDraft] = React.useState(liveSettings);

  React.useEffect(() => {
    if (isOpen) {
      setDraft(liveSettings);
    }
  }, [isOpen, liveSettings]);

  const { questionCount, answerMode, studyStarred, questionTypes } = draft;
  const maxQuestions = Math.max(1, studyStarred ? starredTerms : allTerms);
  const sliderMax = Math.max(2, maxQuestions);
  const clampedCount = Math.min(Math.max(1, questionCount), maxQuestions);
  const enabled = questionTypes.length > 0;

  const mutedColor = useColorModeValue("gray.600", "gray.400");

  const ButtonWrapper: React.FC<React.PropsWithChildren> = ({ children }) => {
    if (enabled) return <>{children}</>;
    return (
      <Tooltip label="Select at least one question type">{children}</Tooltip>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      motionPreset="slideInTop"
      initialFocusRef={startRef}
    >
      <Modal.Overlay />
      <Modal.Content>
        <Modal.Body>
          <Flex justifyContent="space-between">
            <Modal.Heading size="xl">Set up your test</Modal.Heading>
            <IconButton
              rounded="full"
              aria-label="Close"
              icon={<IconX />}
              variant="ghost"
              colorScheme="gray"
              onClick={onClose}
            />
          </Flex>
          <Stack spacing="8">
            <HStack
              gap={{ base: 4, sm: 8 }}
              flexDir={{ base: "column", sm: "row" }}
              alignItems={{ base: "start", sm: "center" }}
              justifyContent="space-between"
            >
              <Stack spacing="0">
                <Text fontWeight={600} fontFamily="heading">
                  Questions
                </Text>
              </Stack>
              <Slider
                min={1}
                max={sliderMax}
                step={1}
                isDisabled={maxQuestions <= 1}
                value={clampedCount}
                onChange={(v) => {
                  setDraft((prev) => ({ ...prev, questionCount: v }));
                }}
              >
                <SliderTrack
                  bg="gray.100"
                  _dark={{
                    bg: "gray.700",
                  }}
                  h="3px"
                  rounded="full"
                >
                  <Box position="relative" right={10} />
                  <SliderFilledTrack bg="blue.300" />
                </SliderTrack>
                <SliderThumb
                  boxSize={12}
                  borderWidth="3px"
                  bg="white"
                  borderColor="blue.300"
                  _dark={{
                    bg: "gray.800",
                    borderColor: "blue.300",
                  }}
                  shadow="md"
                  transitionProperty="transform,border-width"
                  transitionDuration="normal"
                  _active={{
                    transform: `translateY(-50%) scale(1.3)`,
                    borderWidth: "2.3px",
                  }}
                >
                  <Text
                    color="gray.900"
                    _dark={{
                      color: "white",
                    }}
                    fontSize="sm"
                    fontWeight={700}
                    fontFamily="heading"
                  >
                    {clampedCount}
                  </Text>
                </SliderThumb>
              </Slider>
            </HStack>
            <SimpleGrid columns={{ base: 1, sm: 2 }} spacing="3">
              {Object.values(TestQuestionType).map((t) => (
                <GridItem key={t}>
                  <QuestionTypeComponent
                    type={t}
                    checked={questionTypes.includes(t)}
                    onToggle={() =>
                      setDraft((prev) => ({
                        ...prev,
                        questionTypes: prev.questionTypes.includes(t)
                          ? prev.questionTypes.filter((q) => q !== t)
                          : [...prev.questionTypes, t],
                      }))
                    }
                  />
                </GridItem>
              ))}
            </SimpleGrid>
          </Stack>
          <HStack
            mt="4"
            gap={{ base: 4, sm: 8 }}
            flexDir={{ base: "column", sm: "row" }}
            alignItems={{ base: "start", md: "center" }}
            justifyContent="space-between"
          >
            <Stack spacing="0">
              <Text fontWeight={600}>Terms</Text>
              <Text fontSize="sm" color={mutedColor}>
                Choose which terms to study
              </Text>
            </Stack>
            <ToggleGroup
              index={studyStarred ? 1 : 0}
              tabProps={{
                fontWeight: 600,
              }}
            >
              <ToggleGroup.Tab
                onClick={() => {
                  setDraft((prev) => ({ ...prev, studyStarred: false }));
                }}
              >
                All
              </ToggleGroup.Tab>
              <ToggleGroup.Tab
                onClick={() => {
                  setDraft((prev) => ({
                    ...prev,
                    studyStarred: true,
                    questionCount: Math.max(
                      1,
                      Math.min(prev.questionCount, starredTerms),
                    ),
                  }));
                }}
                isDisabled={!starredTerms && !studyStarred}
              >
                Starred
              </ToggleGroup.Tab>
            </ToggleGroup>
          </HStack>
          <Modal.Divider />
          <HStack
            gap={{ base: 4, sm: 8 }}
            flexDir={{ base: "column", sm: "row" }}
            alignItems={{ base: "start", md: "center" }}
            justifyContent="space-between"
          >
            <Stack spacing="0">
              <Text fontWeight={600}>Answer with</Text>
              <Text fontSize="sm" color={mutedColor}>
                Choose how to answer questions
              </Text>
            </Stack>
            <Box w="40">
              <SelectAnswerMode
                value={answerMode}
                onChange={(v) => {
                  setDraft((prev) => ({ ...prev, answerMode: v }));
                }}
              />
            </Box>
          </HStack>
        </Modal.Body>
        <Modal.Divider />
        <Modal.Footer>
          <ButtonWrapper>
            <Button
              ref={startRef}
              isDisabled={!enabled}
              onClick={() => {
                setSettings({
                  ...draft,
                  questionCount: clampedCount,
                });
                onReset();
                onClose();
              }}
            >
              Start test
            </Button>
          </ButtonWrapper>
        </Modal.Footer>
      </Modal.Content>
    </Modal>
  );
};

const QuestionTypeComponent: React.FC<{
  type: TestQuestionType;
  checked: boolean;
  onToggle: () => void;
}> = ({ type, checked, onToggle }) => {
  const Icon = getQuestionTypeIcon(type);

  const selectedBorder = useColorModeValue("blue.600", "blue.200");
  const defaultBorder = useColorModeValue("gray.200", "gray.600");

  return (
    <Button
      w="full"
      variant="outline"
      rounded="xl"
      bg="transparent"
      borderWidth="2px"
      borderColor={checked ? selectedBorder : defaultBorder}
      py="6"
      px="4"
      colorScheme="gray"
      onClick={onToggle}
    >
      <HStack w="full">
        <Box
          transition="color 0.15s ease-in-out"
          color={checked ? selectedBorder : "gray.400"}
          _dark={{
            color: checked ? selectedBorder : "gray.500",
          }}
        >
          <Icon size={20} />
        </Box>
        <Text fontWeight={600}>{getQuestionTypeName(type)}</Text>
      </HStack>
    </Button>
  );
};
