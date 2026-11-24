import React, { useId, useState, type FC } from 'react';
import {
  Badge,
  Box,
  Button,
  Checkbox,
  Flex,
  HStack,
  Icon,
  IconButton,
  Input,
  Select,
  Stack,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tooltip,
  Tr,
  VisuallyHidden,
  useColorModeValue,
} from '@chakra-ui/react';
import {
  IconAlertTriangle,
  IconArrowDown,
  IconArrowUp,
  IconArrowsSort,
  IconBook,
  IconCheck,
  IconCopy,
  IconDownload,
  IconEdit,
  IconHeadphones,
  IconMicrophone,
  IconPencil,
  IconPlayerPlay,
  IconTrash,
  IconX,
} from '@tabler/icons-react';

import type { CloudIeltsSkill } from '../../../utils/cloudSync';
import {
  formatShortUpdated,
  resolveCollectionOption,
  type CollectionItem,
  type SortDirection,
  type SortField,
  type UnifiedTestRow,
} from './ManageHelpers';

interface ManageTestsTableProps {
  rows: UnifiedTestRow[];
  totalRowsCount: number;
  collections: CollectionItem[];
  selectedKeys: Set<string>;
  sortField: SortField;
  sortDirection: SortDirection;
  bulkMoveTarget: string;
  isBusy: boolean;
  onSortChange: (field: SortField) => void;
  onToggleRow: (key: string) => void;
  onToggleSelectAllVisible: () => void;
  onClearSelection: () => void;
  onBulkMoveTargetChange: (col: string) => void;
  onBulkMove: () => void;
  onBulkExport: (rows: UnifiedTestRow[]) => void;
  onBulkDelete: (rows: UnifiedTestRow[]) => void;
  onMoveSingleTest: (row: UnifiedTestRow, nextCollection: string) => void;
  onQuickRenameTest: (row: UnifiedTestRow, nextTitle: string) => void;
  onPreviewTest: (row: UnifiedTestRow) => void;
  onEditTest: (row: UnifiedTestRow) => void;
  onDuplicateTest: (row: UnifiedTestRow) => void;
  onExportTest: (row: UnifiedTestRow) => void;
  onDeleteTest: (row: UnifiedTestRow) => void;
  onCreateNew: () => void;
  onResetFilters?: () => void;
  hasActiveFilters: boolean;
}

const getSkillBadgeProps = (skill: CloudIeltsSkill) => {
  if (skill === 'Listening') return { colorScheme: 'purple', icon: IconHeadphones };
  if (skill === 'Writing') return { colorScheme: 'orange', icon: IconPencil };
  if (skill === 'Speaking') return { colorScheme: 'pink', icon: IconMicrophone };
  return { colorScheme: 'blue', icon: IconBook };
};

export const ManageTestsTable: FC<ManageTestsTableProps> = ({
  rows,
  totalRowsCount,
  collections,
  selectedKeys,
  sortField,
  sortDirection,
  bulkMoveTarget,
  isBusy,
  onSortChange,
  onToggleRow,
  onToggleSelectAllVisible,
  onClearSelection,
  onBulkMoveTargetChange,
  onBulkMove,
  onBulkExport,
  onBulkDelete,
  onMoveSingleTest,
  onQuickRenameTest,
  onPreviewTest,
  onEditTest,
  onDuplicateTest,
  onExportTest,
  onDeleteTest,
  onCreateNew,
  onResetFilters,
  hasActiveFilters,
}) => {
  const captionId = useId();
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>('');
  const [sortStatusText, setSortStatusText] = useState<string>('');

  const cardBg = useColorModeValue('white', 'gray.800');
  const cardBorder = useColorModeValue('gray.200', 'gray.700');
  const theadBg = useColorModeValue('gray.50', 'gray.900');
  const rowHoverBg = useColorModeValue('blue.50', 'whiteAlpha.50');
  const subtleBg = useColorModeValue('gray.50', 'gray.900');
  const secondaryColor = useColorModeValue('gray.600', 'gray.400');
  const bulkBg = useColorModeValue('blue.50', 'blue.900');
  const bulkBorder = useColorModeValue('blue.300', 'blue.600');

  // Scope bulk actions strictly to currently visible rows so hidden tests are never affected
  const visibleSelectedRows = rows.filter((r) => selectedKeys.has(r.key));
  const allVisibleSelected = rows.length > 0 && visibleSelectedRows.length === rows.length;
  const isIndeterminate = visibleSelectedRows.length > 0 && !allVisibleSelected;

  const startInlineRename = (row: UnifiedTestRow) => {
    setEditingKey(row.key);
    setEditingTitle(row.title);
  };

  const commitInlineRename = (row: UnifiedTestRow) => {
    const trimmed = editingTitle.trim();
    setEditingKey(null);
    if (!trimmed || trimmed === row.title) return;
    onQuickRenameTest(row, trimmed);
  };

  const triggerSort = (field: SortField, label: string) => {
    const nextDir: SortDirection =
      sortField === field ? (sortDirection === 'asc' ? 'desc' : 'asc') : 'asc';
    setSortStatusText(`Sorted by ${label}, ${nextDir}ending, ${rows.length} rows`);
    onSortChange(field);
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <Icon as={IconArrowsSort} boxSize={3.5} opacity={0.45} aria-hidden="true" />;
    }
    return (
      <Icon
        as={sortDirection === 'asc' ? IconArrowUp : IconArrowDown}
        boxSize={3.5}
        color="blue.500"
        aria-hidden="true"
      />
    );
  };

  const renderSortableTh = (field: SortField, label: string, isNumeric = false) => {
    const isActive = sortField === field;
    return (
      <Th
        scope="col"
        isNumeric={isNumeric}
        p={0}
        aria-sort={isActive ? (sortDirection === 'asc' ? 'ascending' : 'descending') : undefined}
        bg={theadBg}
      >
        <Button
          type="button"
          variant="ghost"
          size="xs"
          w="full"
          h="38px"
          px={3}
          rounded={0}
          justifyContent={isNumeric ? 'flex-end' : 'flex-start'}
          fontWeight={800}
          fontSize="xs"
          textTransform="uppercase"
          letterSpacing="wider"
          color={isActive ? 'blue.500' : secondaryColor}
          rightIcon={renderSortIcon(field)}
          onClick={() => triggerSort(field, label)}
        >
          {label}
        </Button>
      </Th>
    );
  };

  return (
    <Stack spacing={3}>
      {/* Sticky Bulk Action Bar scoped strictly to visible selected rows */}
      {visibleSelectedRows.length > 0 && (
        <Flex
          position="sticky"
          top={2}
          zIndex={20}
          justify="space-between"
          align={{ base: 'start', md: 'center' }}
          direction={{ base: 'column', md: 'row' }}
          gap={3}
          p={3.5}
          bg={bulkBg}
          borderWidth="2px"
          borderColor={bulkBorder}
          rounded="xl"
          shadow="md"
        >
          <HStack spacing={3}>
            <Checkbox
              isChecked={allVisibleSelected}
              isIndeterminate={isIndeterminate}
              onChange={onToggleSelectAllVisible}
              colorScheme="blue"
            >
              <Text fontSize="sm" fontWeight={700}>
                {visibleSelectedRows.length} selected (visible)
              </Text>
            </Checkbox>
            <Button size="xs" variant="ghost" onClick={onClearSelection}>
              Clear
            </Button>
          </HStack>

          <HStack spacing={2} flexWrap="wrap">
            <Select
              size="sm"
              w="185px"
              bg={cardBg}
              rounded="xl"
              value={bulkMoveTarget || collections[0]?.name || ''}
              onChange={(e) => onBulkMoveTargetChange(e.target.value)}
            >
              {collections.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Button
              size="sm"
              colorScheme="blue"
              rounded="xl"
              isLoading={isBusy}
              onClick={onBulkMove}
            >
              Move Selected
            </Button>
            <Button
              size="sm"
              variant="outline"
              bg={cardBg}
              rounded="xl"
              leftIcon={<IconDownload size={15} />}
              isDisabled={isBusy}
              onClick={() => onBulkExport(visibleSelectedRows)}
            >
              Export Bundle
            </Button>
            <Button
              size="sm"
              colorScheme="red"
              variant="solid"
              rounded="xl"
              leftIcon={<IconTrash size={15} />}
              isDisabled={isBusy}
              onClick={() => onBulkDelete(visibleSelectedRows)}
            >
              Delete ({visibleSelectedRows.length})
            </Button>
          </HStack>
        </Flex>
      )}

      {/* Summary strip */}
      <Flex justify="space-between" align="center" px={1} flexWrap="wrap" gap={2}>
        <Text fontSize="xs" color={secondaryColor} fontWeight={600}>
          Showing {rows.length} of {totalRowsCount} tests
        </Text>
        <VisuallyHidden role="status">{sortStatusText}</VisuallyHidden>
      </Flex>

      {rows.length === 0 ? (
        <Box
          p={10}
          bg={cardBg}
          borderWidth="2px"
          borderColor={cardBorder}
          rounded="2xl"
          textAlign="center"
        >
          <Text fontSize="sm" color={secondaryColor} mb={3}>
            No tests match the current filters.
          </Text>
          <HStack justify="center" spacing={2}>
            {hasActiveFilters && onResetFilters && (
              <Button size="sm" variant="outline" rounded="xl" onClick={onResetFilters}>
                Reset Filters
              </Button>
            )}
            <Button size="sm" colorScheme="blue" rounded="xl" onClick={onCreateNew}>
              Smart Add Test
            </Button>
          </HStack>
        </Box>
      ) : (
        <>
          {/* Desktop Compact Sortable Table */}
          <Box
            display={{ base: 'none', md: 'block' }}
            bg={cardBg}
            borderWidth="2px"
            borderColor={cardBorder}
            rounded="2xl"
            overflowX="auto"
            maxH="70vh"
            overflowY="auto"
            tabIndex={0}
            role="region"
            aria-labelledby={captionId}
            shadow="xs"
          >
            <Table size="sm" variant="simple">
              <VisuallyHidden as="caption" id={captionId}>
                IELTS Practice Tests Library
              </VisuallyHidden>
              <Thead position="sticky" top={0} zIndex={10} bg={theadBg}>
                <Tr>
                  <Th scope="col" w="40px" px={3} bg={theadBg}>
                    <Checkbox
                      isChecked={allVisibleSelected}
                      isIndeterminate={isIndeterminate}
                      onChange={onToggleSelectAllVisible}
                      colorScheme="blue"
                      aria-label="Select all visible tests"
                    />
                  </Th>
                  {renderSortableTh('title', 'Test Title')}
                  {renderSortableTh('skill', 'Skill')}
                  {renderSortableTh('collection', 'Collection')}
                  {renderSortableTh('questions', 'Qs', true)}
                  {renderSortableTh('updatedAt', 'Updated')}
                  <Th scope="col" textAlign="right" px={3} bg={theadBg} fontSize="xs" color={secondaryColor}>
                    Actions
                  </Th>
                </Tr>
              </Thead>
              <Tbody>
                {rows.map((row) => {
                  const { colorScheme, icon } = getSkillBadgeProps(row.skill);
                  const isChecked = selectedKeys.has(row.key);
                  const isEditingThis = editingKey === row.key;
                  const canonicalCollection = resolveCollectionOption(row.collection, collections);
                  const hasCanonical = collections.some(
                    (c) => c.name.toLowerCase() === canonicalCollection.toLowerCase()
                  );

                  return (
                    <Tr
                      key={row.key}
                      bg={isChecked ? rowHoverBg : undefined}
                      _hover={{ bg: rowHoverBg }}
                      transition="background-color 100ms ease"
                    >
                      <Td px={3}>
                        <Checkbox
                          isChecked={isChecked}
                          onChange={() => onToggleRow(row.key)}
                          colorScheme="blue"
                          aria-label={`Select ${row.title}`}
                        />
                      </Td>

                      <Td maxW="340px" py={2.5}>
                        {isEditingThis ? (
                          <HStack spacing={1}>
                            <Input
                              size="xs"
                              value={editingTitle}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  commitInlineRename(row);
                                } else if (e.key === 'Escape') {
                                  e.preventDefault();
                                  setEditingKey(null);
                                }
                              }}
                              autoFocus
                              rounded="md"
                            />
                            <IconButton
                              size="xs"
                              colorScheme="blue"
                              aria-label="Save title"
                              icon={<IconCheck size={13} />}
                              onClick={() => commitInlineRename(row)}
                            />
                            <IconButton
                              size="xs"
                              variant="ghost"
                              aria-label="Cancel rename"
                              icon={<IconX size={13} />}
                              onClick={() => setEditingKey(null)}
                            />
                          </HStack>
                        ) : (
                          <Stack spacing={0.5}>
                            <HStack spacing={1.5} align="center">
                              <Text
                                fontWeight={700}
                                fontSize="xs"
                                noOfLines={1}
                                cursor="pointer"
                                title="Double-click to rename"
                                onDoubleClick={() => startInlineRename(row)}
                              >
                                {row.title}
                              </Text>
                              <Tooltip label="Quick rename">
                                <IconButton
                                  size="xs"
                                  variant="ghost"
                                  h="18px"
                                  minW="18px"
                                  aria-label={`Rename ${row.title}`}
                                  icon={<IconPencil size={12} />}
                                  opacity={0.55}
                                  _hover={{ opacity: 1 }}
                                  onClick={() => startInlineRename(row)}
                                />
                              </Tooltip>
                              <Badge
                                fontSize="9px"
                                variant="outline"
                                colorScheme={row.isBuiltin ? 'gray' : 'teal'}
                                rounded="sm"
                                px={1}
                              >
                                {row.isBuiltin ? 'Built-in' : 'Custom'}
                              </Badge>
                              {row.healthWarnings.length > 0 && (
                                <Tooltip label={row.healthWarnings.join(' · ')}>
                                  <Box as="span" color="orange.400" display="inline-flex">
                                    <IconAlertTriangle size={14} />
                                  </Box>
                                </Tooltip>
                              )}
                            </HStack>
                            <Text fontSize="11px" color={secondaryColor} noOfLines={1}>
                              {row.meta}
                            </Text>
                          </Stack>
                        )}
                      </Td>

                      <Td>
                        <Badge colorScheme={colorScheme} variant="subtle" rounded="md" px={2} py={0.5}>
                          <HStack spacing={1}>
                            <Icon as={icon} boxSize={3} />
                            <Text fontSize="11px">{row.skill}</Text>
                          </HStack>
                        </Badge>
                      </Td>

                      <Td>
                        <Select
                          size="xs"
                          w="148px"
                          rounded="lg"
                          bg={subtleBg}
                          value={canonicalCollection}
                          isDisabled={isBusy}
                          onChange={(e) => onMoveSingleTest(row, e.target.value)}
                          aria-label={`Collection for ${row.title}`}
                        >
                          {!hasCanonical && (
                            <option value={canonicalCollection}>{canonicalCollection}</option>
                          )}
                          {collections.map((c) => (
                            <option key={c.id} value={c.name}>
                              {c.name}
                            </option>
                          ))}
                        </Select>
                      </Td>

                      <Td isNumeric fontWeight={700} fontSize="xs">
                        {row.questionCount > 0 ? row.questionCount : '—'}
                      </Td>

                      <Td fontSize="xs" color={secondaryColor} whiteSpace="nowrap">
                        {formatShortUpdated(row.updatedAt)}
                      </Td>

                      <Td textAlign="right" px={3}>
                        <HStack spacing={1} justify="flex-end">
                          <Tooltip label="Preview / Start test">
                            <IconButton
                              size="xs"
                              variant="ghost"
                              colorScheme="blue"
                              rounded="md"
                              aria-label={`Preview ${row.title}`}
                              icon={<IconPlayerPlay size={14} />}
                              onClick={() => onPreviewTest(row)}
                            />
                          </Tooltip>
                          <Tooltip label="Edit test">
                            <IconButton
                              size="xs"
                              variant="outline"
                              rounded="md"
                              aria-label={`Edit ${row.title}`}
                              icon={<IconEdit size={14} />}
                              onClick={() => onEditTest(row)}
                            />
                          </Tooltip>
                          <Tooltip label="Duplicate test">
                            <IconButton
                              size="xs"
                              variant="outline"
                              rounded="md"
                              aria-label={`Duplicate ${row.title}`}
                              icon={<IconCopy size={14} />}
                              isDisabled={isBusy}
                              onClick={() => onDuplicateTest(row)}
                            />
                          </Tooltip>
                          <Tooltip label="Export JSON">
                            <IconButton
                              size="xs"
                              variant="outline"
                              rounded="md"
                              aria-label={`Export ${row.title}`}
                              icon={<IconDownload size={14} />}
                              onClick={() => onExportTest(row)}
                            />
                          </Tooltip>
                          <Tooltip label="Delete test">
                            <IconButton
                              size="xs"
                              variant="outline"
                              colorScheme="red"
                              rounded="md"
                              aria-label={`Delete ${row.title}`}
                              icon={<IconTrash size={14} />}
                              isDisabled={isBusy}
                              onClick={() => onDeleteTest(row)}
                            />
                          </Tooltip>
                        </HStack>
                      </Td>
                    </Tr>
                  );
                })}
              </Tbody>
            </Table>
          </Box>

          {/* Mobile Stacked Cards */}
          <Stack display={{ base: 'flex', md: 'none' }} spacing={2.5}>
            {rows.map((row) => {
              const { colorScheme, icon } = getSkillBadgeProps(row.skill);
              const isChecked = selectedKeys.has(row.key);
              const canonicalCollection = resolveCollectionOption(row.collection, collections);
              const hasCanonical = collections.some(
                (c) => c.name.toLowerCase() === canonicalCollection.toLowerCase()
              );

              return (
                <Box
                  key={row.key}
                  p={3.5}
                  bg={cardBg}
                  borderWidth="2px"
                  borderColor={isChecked ? 'blue.400' : cardBorder}
                  rounded="xl"
                >
                  <Stack spacing={2.5}>
                    <HStack spacing={2.5} align="start">
                      <Checkbox
                        mt={1}
                        isChecked={isChecked}
                        onChange={() => onToggleRow(row.key)}
                        colorScheme="blue"
                      />
                      <Stack spacing={1} flex={1} minW={0}>
                        <HStack spacing={1.5} flexWrap="wrap">
                          <Badge colorScheme={colorScheme} variant="subtle" rounded="md" px={2}>
                            <HStack spacing={1}>
                              <Icon as={icon} boxSize={3} />
                              <Text fontSize="10px">{row.skill}</Text>
                            </HStack>
                          </Badge>
                          <Badge
                            fontSize="9px"
                            variant="outline"
                            colorScheme={row.isBuiltin ? 'gray' : 'teal'}
                          >
                            {row.isBuiltin ? 'Built-in' : 'Custom'}
                          </Badge>
                          {row.healthWarnings.length > 0 && (
                            <Tooltip label={row.healthWarnings.join(' · ')}>
                              <Box as="span" color="orange.400" display="inline-flex">
                                <IconAlertTriangle size={14} />
                              </Box>
                            </Tooltip>
                          )}
                        </HStack>
                        <Text fontWeight={700} fontSize="sm" noOfLines={2}>
                          {row.title}
                        </Text>
                        <Text fontSize="xs" color={secondaryColor}>
                          {row.meta}
                        </Text>
                      </Stack>
                    </HStack>

                    <Flex justify="space-between" align="center" gap={2} flexWrap="wrap">
                      <Select
                        size="xs"
                        w="150px"
                        rounded="lg"
                        bg={subtleBg}
                        value={canonicalCollection}
                        isDisabled={isBusy}
                        onChange={(e) => onMoveSingleTest(row, e.target.value)}
                      >
                        {!hasCanonical && (
                          <option value={canonicalCollection}>{canonicalCollection}</option>
                        )}
                        {collections.map((c) => (
                          <option key={c.id} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                      </Select>

                      <HStack spacing={1}>
                        <IconButton
                          size="xs"
                          variant="ghost"
                          colorScheme="blue"
                          aria-label={`Preview ${row.title}`}
                          icon={<IconPlayerPlay size={14} />}
                          onClick={() => onPreviewTest(row)}
                        />
                        <IconButton
                          size="xs"
                          variant="outline"
                          aria-label={`Edit ${row.title}`}
                          icon={<IconEdit size={14} />}
                          onClick={() => onEditTest(row)}
                        />
                        <IconButton
                          size="xs"
                          variant="outline"
                          aria-label={`Duplicate ${row.title}`}
                          icon={<IconCopy size={14} />}
                          onClick={() => onDuplicateTest(row)}
                        />
                        <IconButton
                          size="xs"
                          variant="outline"
                          aria-label={`Export ${row.title}`}
                          icon={<IconDownload size={14} />}
                          onClick={() => onExportTest(row)}
                        />
                        <IconButton
                          size="xs"
                          variant="outline"
                          colorScheme="red"
                          aria-label={`Delete ${row.title}`}
                          icon={<IconTrash size={14} />}
                          onClick={() => onDeleteTest(row)}
                        />
                      </HStack>
                    </Flex>
                  </Stack>
                </Box>
              );
            })}
          </Stack>
        </>
      )}
    </Stack>
  );
};
