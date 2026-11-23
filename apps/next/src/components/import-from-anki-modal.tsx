import React, { useState, useRef } from "react";
import { useRouter } from "next/router";
import { signIn } from "next-auth/react";
import JSZip from "jszip";
import * as fzstd from "fzstd";
import { Modal } from "@quenti/components/modal";
import { decodeProtobufMedia } from "@quenti/lib/src/anki/protobuf-media";
import { api } from "@quenti/trpc";
import {
  Button,
  ButtonGroup,
  Stack,
  Text,
  Progress,
  Box,
  HStack,
  Icon,
  Divider,
  useColorModeValue,
} from "@chakra-ui/react";
import {
  IconUpload,
  IconFileZip,
  IconAlertCircle,
  IconBrandGoogleDrive,
} from "@tabler/icons-react";
import { effectChannel } from "../events/effects";

export interface ImportFromAnkiModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface DriveFileItem {
  id: string;
  name: string;
  sizeBytes: number;
  modifiedTime: string;
}

export const ImportFromAnkiModal: React.FC<ImportFromAnkiModalProps> = ({
  isOpen,
  onClose,
}) => {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");
  const [driveFiles, setDriveFiles] = useState<DriveFileItem[] | null>(null);
  const [driveLoading, setDriveLoading] = useState(false);
  const [driveNeedsConsent, setDriveNeedsConsent] = useState(false);

  const dropzoneBg = useColorModeValue("gray.50", "gray.900");
  const borderColor = useColorModeValue("gray.300", "gray.700");
  const secondaryText = useColorModeValue("gray.600", "gray.400");
  const driveRowHoverBg = useColorModeValue("gray.100", "gray.800");

  const onImportSuccess = async (data: { createdSetId?: string }) => {
    setLoading(false);
    setProgressMsg("Import complete!");
    effectChannel.emit("prepareConfetti");
    effectChannel.emit("confetti");

    resetState();
    onClose();
    if (data.createdSetId) {
      await router.push(`/${data.createdSetId}`);
    }
  };
  const onImportError = (err: { message?: string }) => {
    setLoading(false);
    const msg = err.message || "";
    if (msg.includes("DRIVE_NEEDS_CONSENT") || msg.includes("DRIVE_NO_ACCOUNT")) {
      setDriveFiles(null);
      setDriveNeedsConsent(true);
      setError("");
      return;
    }
    setError(msg || "Failed to import Anki package. Please try again.");
  };

  const importMutation = api.anki.importPackage.useMutation({
    onSuccess: onImportSuccess,
    onError: onImportError,
  });

  const driveImportMutation = api.anki.importFromDrive.useMutation({
    onSuccess: onImportSuccess,
    onError: onImportError,
  });

  const driveListQuery = api.anki.listDriveDecks.useQuery(
    {},
    { enabled: false, retry: false },
  );

  const handleLoadDriveFiles = async () => {
    setError("");
    setDriveNeedsConsent(false);
    setDriveLoading(true);
    const res = await driveListQuery.refetch();
    setDriveLoading(false);
    if (res.error) {
      const msg = res.error.message || "";
      if (msg.includes("DRIVE_NEEDS_CONSENT") || msg.includes("DRIVE_NO_ACCOUNT")) {
        setDriveNeedsConsent(true);
      } else {
        setError(msg || "Could not load your Google Drive files.");
      }
      return;
    }
    setDriveFiles(res.data?.files ?? []);
  };

  const handleDriveImport = (file: DriveFileItem) => {
    const sizeMb = file.sizeBytes / (1024 * 1024);
    if (sizeMb > 50) {
      setError(
        `This file is ${sizeMb.toFixed(1)}MB. In-app Google Drive import supports packages up to 50MB.`,
      );
      return;
    }
    setError("");
    setLoading(true);
    setProgressMsg(`Downloading "${file.name}" from Google Drive...`);
    driveImportMutation.mutate({ fileId: file.id, fileName: file.name });
  };

  const acceptApkgFile = (file?: File | null) => {
    if (!file) return;
    setError("");
    if (!file.name.toLowerCase().endsWith(".apkg")) {
      setError("Please select a valid Anki package (.apkg) file.");
      return;
    }
    setSelectedFile(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    acceptApkgFile(e.target.files?.[0]);
  };

  const handleImport = async () => {
    if (!selectedFile) return;

    const sizeMb = selectedFile.size / (1024 * 1024);
    if (sizeMb > 100) {
      setError(
        `This file is ${sizeMb.toFixed(1)}MB. Please select an Anki package under 100MB.`,
      );
      return;
    }

    setLoading(true);
    setError("");
    setProgressMsg("Reading Anki package...");

    try {
      // Fast direct path for small packages (<= 2.8 MB)
      if (sizeMb <= 2.8) {
        const arrayBuf = await selectedFile.arrayBuffer();
        const bytes = new Uint8Array(arrayBuf);
        let binary = "";
        const chunkSize = 0x8000;
        for (let i = 0; i < bytes.length; i += chunkSize) {
          binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
        }
        const base64 = window.btoa(binary);
        setProgressMsg("Parsing decks, cards, and media...");
        importMutation.mutate({
          fileBase64: base64,
          fileName: selectedFile.name,
        });
        return;
      }

      // Smart client-side split for large packages (> 2.8 MB up to 100 MB)
      setProgressMsg("Unpacking large Anki archive in browser...");
      const zip = await JSZip.loadAsync(await selectedFile.arrayBuffer());

      // Parse media manifest (JSON or Anki 2.1.50+ Zstd/Protobuf)
      let mediaMap: Record<string, string> = {};
      const mediaEntry = zip.file("media");
      if (mediaEntry) {
        let mediaBytes = await mediaEntry.async("uint8array");
        if (
          mediaBytes.length >= 4 &&
          mediaBytes[0] === 0x28 &&
          mediaBytes[1] === 0xb5 &&
          mediaBytes[2] === 0x2f &&
          mediaBytes[3] === 0xfd
        ) {
          mediaBytes = fzstd.decompress(mediaBytes);
        }
        const text = new TextDecoder("utf-8", { fatal: false }).decode(
          mediaBytes,
        );
        if (text.trim().startsWith("{")) {
          try {
            mediaMap = JSON.parse(text) as Record<string, string>;
          } catch {
            mediaMap = decodeProtobufMedia(mediaBytes);
          }
        } else {
          mediaMap = decodeProtobufMedia(mediaBytes);
        }
      }

      // Upload media files in <= 2.2 MB batches so no request exceeds Vercel's 4.5 MB body limit
      const importId = `${Date.now().toString(36)}${Math.random()
        .toString(36)
        .slice(2, 8)}`;
      let resolvedMediaBase: string | undefined;
      const mediaEntries = Object.entries(mediaMap);

      if (mediaEntries.length > 0) {
        let currentBatch: { name: string; base64: string }[] = [];
        let currentBatchBytes = 0;
        const maxBatchBytes = 2.0 * 1024 * 1024;
        let processedCount = 0;

        const flushBatch = async () => {
          if (currentBatch.length === 0) return;
          setProgressMsg(
            `Uploading media files (${processedCount}/${mediaEntries.length})...`,
          );
          const resp = await fetch("/api/anki/upload-media-batch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              importId,
              files: currentBatch,
            }),
          });
          if (resp.ok) {
            const data = (await resp.json()) as { mediaBase?: string | null };
            if (data.mediaBase) resolvedMediaBase = data.mediaBase;
          } else {
            throw new Error(
              `Media batch upload failed (${resp.status}). Please retry or check server media storage settings.`,
            );
          }
          currentBatch = [];
          currentBatchBytes = 0;
        };

        for (const [entryId, realName] of mediaEntries) {
          const entry = zip.file(entryId);
          processedCount++;
          if (!entry) continue;
          const base64 = await entry.async("base64");
          const approxBytes = base64.length;
          if (approxBytes > 2.8 * 1024 * 1024) continue; // skip single oversized media > 2.8MB
          if (
            currentBatch.length > 0 &&
            currentBatchBytes + approxBytes > maxBatchBytes
          ) {
            await flushBatch();
          }
          currentBatch.push({ name: realName, base64 });
          currentBatchBytes += approxBytes;
        }
        await flushBatch();
      }

      // Build lightweight collection-only .apkg zip
      setProgressMsg("Importing decks and flashcards...");
      const miniZip = new JSZip();
      for (const colName of [
        "collection.anki21b",
        "collection.anki21",
        "collection.anki2",
        "media",
      ]) {
        const entry = zip.file(colName);
        if (entry) {
          miniZip.file(colName, await entry.async("uint8array"));
        }
      }

      const miniBase64 = await miniZip.generateAsync({
        type: "base64",
        compression: "DEFLATE",
      });

      importMutation.mutate({
        fileBase64: miniBase64,
        fileName: selectedFile.name,
        mediaBaseOverride: resolvedMediaBase,
      });
    } catch (err: unknown) {
      setLoading(false);
      setError(err instanceof Error ? err.message : "Error processing file.");
    }
  };

  const resetState = () => {
    setSelectedFile(null);
    setError("");
    setLoading(false);
    setProgressMsg("");
    setDriveFiles(null);
    setDriveNeedsConsent(false);
  };

  return (
    <Modal
      onClose={() => {
        if (!loading) {
          resetState();
          onClose();
        }
      }}
      isOpen={isOpen}
      size="xl"
    >
      <Modal.Overlay />
      <Modal.Content>
        <Modal.Body>
          <Modal.Heading>Import from Anki</Modal.Heading>
          <Stack spacing={4} mt={2}>
            <Text color={secondaryText} fontSize="sm">
              Upload an Anki deck package (<code>.apkg</code>). Sub-decks, card templates,
              embedded audio, images, and cloze deletions will be automatically preserved.
            </Text>

            <Box
              border="2px dashed"
              borderColor={borderColor}
              rounded="xl"
              p={6}
              bg={dropzoneBg}
              textAlign="center"
              cursor={loading ? "not-allowed" : "pointer"}
              onClick={() => !loading && fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (!loading) acceptApkgFile(e.dataTransfer.files?.[0]);
              }}
              _hover={{ borderColor: "orange.400" }}
              transition="all 0.2s"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".apkg"
                style={{ display: "none" }}
                onChange={handleFileChange}
                disabled={loading}
              />
              <Stack align="center" spacing={2}>
                <Icon
                  as={selectedFile ? IconFileZip : IconUpload}
                  boxSize={10}
                  color={selectedFile ? "orange.400" : "gray.400"}
                />
                {selectedFile ? (
                  <>
                    <Text fontWeight={700}>{selectedFile.name}</Text>
                    <Text fontSize="xs" color={secondaryText}>
                      {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                    </Text>
                  </>
                ) : (
                  <>
                    <Text fontWeight={600}>Click or drag to select an .apkg file</Text>
                    <Text fontSize="xs" color={secondaryText}>
                      Supports modern Anki 2.1 (Zstd) and legacy packages
                    </Text>
                  </>
                )}
              </Stack>
            </Box>

            {!selectedFile && (
              <>
                <HStack>
                  <Divider />
                  <Text fontSize="xs" color={secondaryText} whiteSpace="nowrap">
                    or
                  </Text>
                  <Divider />
                </HStack>

                {driveFiles === null && !driveNeedsConsent && (
                  <Button
                    variant="outline"
                    leftIcon={<Icon as={IconBrandGoogleDrive} />}
                    onClick={handleLoadDriveFiles}
                    isLoading={driveLoading}
                    loadingText="Loading your Drive files..."
                    isDisabled={loading}
                  >
                    Import from Google Drive
                  </Button>
                )}

                {driveNeedsConsent && (
                  <Stack spacing={2}>
                    <Text fontSize="sm" color={secondaryText}>
                      To import from Google Drive, reconnect your Google account
                      and grant read-only Drive access.
                    </Text>
                    <Button
                      colorScheme="orange"
                      variant="outline"
                      leftIcon={<Icon as={IconBrandGoogleDrive} />}
                      onClick={() =>
                        void signIn(
                          "google",
                          {
                            callbackUrl: window.location.pathname,
                          },
                          {
                            scope:
                              "openid email profile https://www.googleapis.com/auth/drive.readonly",
                            access_type: "offline",
                            prompt: "consent",
                            include_granted_scopes: "true",
                          },
                        )
                      }
                    >
                      Reconnect Google
                    </Button>
                  </Stack>
                )}

                {driveFiles !== null && (
                  <Stack spacing={1}>
                    {driveFiles.length === 0 ? (
                      <Text fontSize="sm" color={secondaryText}>
                        No .apkg files found in your Google Drive.
                      </Text>
                    ) : (
                      driveFiles.map((f) => (
                        <Box
                          key={f.id}
                          px={3}
                          py={2}
                          rounded="lg"
                          border="1px solid"
                          borderColor={borderColor}
                          cursor={loading ? "not-allowed" : "pointer"}
                          _hover={{ bg: driveRowHoverBg }}
                          onClick={() => !loading && handleDriveImport(f)}
                        >
                          <HStack justify="space-between">
                            <Text fontSize="sm" fontWeight={600} noOfLines={1}>
                              {f.name}
                            </Text>
                            <Text
                              fontSize="xs"
                              color={secondaryText}
                              whiteSpace="nowrap"
                            >
                              {(f.sizeBytes / (1024 * 1024)).toFixed(1)} MB
                            </Text>
                          </HStack>
                          <Text fontSize="xs" color={secondaryText}>
                            {new Date(f.modifiedTime).toLocaleDateString()}
                          </Text>
                        </Box>
                      ))
                    )}
                    <Text fontSize="xs" color={secondaryText}>
                      Decks over 50 MB may be too large for in-app Google Drive import.
                    </Text>
                  </Stack>
                )}
              </>
            )}

            {loading && (
              <Stack spacing={2} py={2}>
                <Progress size="xs" isIndeterminate colorScheme="orange" rounded="full" />
                <Text fontSize="xs" color={secondaryText} textAlign="center">
                  {progressMsg}
                </Text>
              </Stack>
            )}

            {error && (
              <HStack color="red.500" fontSize="sm" align="start">
                <Icon as={IconAlertCircle} mt={0.5} />
                <Text>{error}</Text>
              </HStack>
            )}

            <ButtonGroup justifyContent="flex-end" pt={2}>
              <Button
                variant="ghost"
                onClick={() => {
                  resetState();
                  onClose();
                }}
                isDisabled={loading}
              >
                Cancel
              </Button>
              <Button
                colorScheme="orange"
                onClick={handleImport}
                isDisabled={!selectedFile || loading}
                isLoading={loading}
              >
                Import Deck
              </Button>
            </ButtonGroup>
          </Stack>
        </Modal.Body>
      </Modal.Content>
    </Modal>
  );
};

export default ImportFromAnkiModal;
