import React, { useMemo, useState, type FC } from 'react';
import { outfit } from '@pno/lib/chakra-theme';
import {
  Badge,
  Box,
  Button,
  Flex,
  Grid,
  GridItem,
  HStack,
  Heading,
  Icon,
  Input,
  InputGroup,
  InputLeftElement,
  Select,
  Stack,
  Text,
  useColorModeValue,
} from '@chakra-ui/react';
import {
  IconEdit,
  IconFolder,
  IconPlus,
  IconSearch,
  IconSparkles,
  IconTrash,
} from '@tabler/icons-react';

import type { CollectionItem, UnifiedTestRow } from './ManageHelpers';

interface ManageCollectionsGridProps {
  collections: CollectionItem[];
  allRows: UnifiedTestRow[];
  onViewTests: (collectionName: string) => void;
  onSmartAddToCollection: (collectionName: string) => void;
  onEditCollection: (col: CollectionItem) => void;
  onDeleteCollection: (colName: string, matchingRows: UnifiedTestRow[]) => void;
  onNewCollection: () => void;
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

export const ManageCollectionsGrid: FC<ManageCollectionsGridProps> = ({
  collections,
  allRows,
  onViewTests,
  onSmartAddToCollection,
  onEditCollection,
  onDeleteCollection,
  onNewCollection,
}) => {
  const [colSearch, setColSearch] = useState('');
  const [colSort, setColSort] = useState<'name' | 'count'>('name');

  const cardBg = useColorModeValue('white', 'gray.800');
  const cardBorder = useColorModeValue('gray.200', 'gray.700');
  const secondaryColor = useColorModeValue('gray.600', 'gray.400');

  const cards = useMemo(() => {
    const q = colSearch.trim().toLowerCase();
    const mapped = collections
      .filter((col) => {
        if (!q) return true;
        return (
          col.name.toLowerCase().includes(q) ||
          (col.description || '').toLowerCase().includes(q)
        );
      })
      .map((col) => {
        const colLower = col.name.toLowerCase();
        const matchingRows = allRows.filter((r) => r.collection.toLowerCase() === colLower);
        return {
          col,
          matchingRows,
          rCount: matchingRows.filter((r) => r.skill === 'Reading').length,
          lCount: matchingRows.filter((r) => r.skill === 'Listening').length,
          wCount: matchingRows.filter((r) => r.skill === 'Writing').length,
          sCount: matchingRows.filter((r) => r.skill === 'Speaking').length,
        };
      });

    if (colSort === 'count') {
      mapped.sort((a, b) => b.matchingRows.length - a.matchingRows.length);
    } else {
      mapped.sort((a, b) => collator.compare(a.col.name, b.col.name));
    }
    return mapped;
  }, [collections, allRows, colSearch, colSort]);

  return (
    <Stack spacing={4}>
      {/* Collection Search & Sort Bar */}
      <Flex
        justify="space-between"
        align={{ base: 'stretch', sm: 'center' }}
        direction={{ base: 'column', sm: 'row' }}
        gap={3}
        p={4}
        bg={cardBg}
        borderWidth="2px"
        borderColor={cardBorder}
        rounded="2xl"
      >
        <HStack spacing={2.5} flex={1}>
          <InputGroup size="sm" maxW="300px">
            <InputLeftElement pointerEvents="none" color="gray.400">
              <IconSearch size={15} />
            </InputLeftElement>
            <Input
              value={colSearch}
              onChange={(e) => setColSearch(e.target.value)}
              placeholder="Search collections..."
              rounded="xl"
            />
          </InputGroup>

          <Select
            size="sm"
            w="165px"
            rounded="xl"
            value={colSort}
            onChange={(e) => setColSort(e.target.value as 'name' | 'count')}
          >
            <option value="name">Sort: Name (A–Z)</option>
            <option value="count">Sort: Most Tests</option>
          </Select>
        </HStack>

        <Button
          size="sm"
          colorScheme="blue"
          variant="outline"
          rounded="xl"
          leftIcon={<IconPlus size={15} />}
          onClick={onNewCollection}
        >
          New Collection
        </Button>
      </Flex>

      {cards.length === 0 ? (
        <Box
          p={10}
          bg={cardBg}
          borderWidth="2px"
          borderColor={cardBorder}
          rounded="2xl"
          textAlign="center"
        >
          <Text fontSize="sm" color={secondaryColor} mb={3}>
            No collections match &ldquo;{colSearch}&rdquo;.
          </Text>
          <Button size="sm" variant="outline" rounded="xl" onClick={() => setColSearch('')}>
            Clear Search
          </Button>
        </Box>
      ) : (
        <Grid templateColumns="repeat(auto-fill, minmax(min(100%, 310px), 1fr))" gap={4}>
          {cards.map(({ col, matchingRows, rCount, lCount, wCount, sCount }) => (
            <GridItem key={col.name}>
              <Box
                h="full"
                p={5}
                bg={cardBg}
                borderWidth="2px"
                borderColor={cardBorder}
                rounded="2xl"
                shadow="sm"
              >
                <Flex direction="column" justify="space-between" h="full" gap={4}>
                  <Stack spacing={2}>
                    <HStack justify="space-between" align="start">
                      <HStack spacing={2} minW={0}>
                        <Icon as={IconFolder} boxSize={5} color="blue.400" flexShrink={0} />
                        <Heading
                          size="md"
                          fontFamily={outfit.style.fontFamily}
                          noOfLines={1}
                        >
                          {col.name}
                        </Heading>
                      </HStack>
                      <Badge colorScheme="gray" variant="subtle" rounded="md" flexShrink={0}>
                        {matchingRows.length} Tests
                      </Badge>
                    </HStack>

                    <Text fontSize="sm" color={secondaryColor} noOfLines={2}>
                      {col.description || 'IELTS practice test collection'}
                    </Text>

                    <HStack spacing={1.5} flexWrap="wrap" pt={1}>
                      <Badge colorScheme="blue" variant="subtle" rounded="md">
                        {rCount} Reading
                      </Badge>
                      <Badge colorScheme="purple" variant="subtle" rounded="md">
                        {lCount} Listening
                      </Badge>
                      <Badge colorScheme="orange" variant="subtle" rounded="md">
                        {wCount} Writing
                      </Badge>
                      <Badge colorScheme="pink" variant="subtle" rounded="md">
                        {sCount} Speaking
                      </Badge>
                    </HStack>
                  </Stack>

                  <Stack spacing={2} pt={2} borderTopWidth="1px" borderColor={cardBorder}>
                    <HStack justify="space-between">
                      <Button
                        size="xs"
                        variant="ghost"
                        colorScheme="blue"
                        rounded="lg"
                        onClick={() => onViewTests(col.name)}
                      >
                        View Tests
                      </Button>

                      <Button
                        size="xs"
                        colorScheme="blue"
                        variant="subtle"
                        rounded="lg"
                        leftIcon={<IconSparkles size={13} />}
                        onClick={() => onSmartAddToCollection(col.name)}
                      >
                        + Add Test
                      </Button>
                    </HStack>

                    <HStack justify="flex-end" spacing={1.5}>
                      <Button
                        size="xs"
                        variant="outline"
                        rounded="lg"
                        leftIcon={<IconEdit size={14} />}
                        onClick={() => onEditCollection(col)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="xs"
                        variant="outline"
                        colorScheme="red"
                        rounded="lg"
                        leftIcon={<IconTrash size={14} />}
                        onClick={() => onDeleteCollection(col.name, matchingRows)}
                      >
                        Delete
                      </Button>
                    </HStack>
                  </Stack>
                </Flex>
              </Box>
            </GridItem>
          ))}
        </Grid>
      )}
    </Stack>
  );
};
