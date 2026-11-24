import React, { useState, useRef } from "react";
import { useRouter } from "next/router";
import { signIn } from "next-auth/react";
import JSZip from "jszip";
import * as fzstd from "fzstd";
import { Modal } from "@pno/components/modal";
import { decodeProtobufMedia } from "@pno/lib/src/anki/protobuf-media";
import {
  detectAnkiMediaContentType,
  packWorkerMediaBatch,
  type WorkerBatchFileInput,
} from "@pno/lib/src/anki/worker-batch";
import { api } from "@pno/trpc";
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

      // Upload media files in parallel batches (3 concurrent workers, <= 45 files or 2 MB per batch)
      const importId = `${Date.now().toString(36)}${Math.random()
        .toString(36)
        .slice(2, 8)}`;
      let resolvedMediaBase: string | undefined;

      // Deduplicate by sanitized filename so identical media aren't uploaded repeatedly
      const dedupedEntries: Array<[string, string]> = [];
      const seenNames = new Set<string>();
      for (const [entryId, rawName] of Object.entries(mediaMap)) {
        const clean =
          rawName
            .replace(/\\/g, "/")
            .split("/")
            .pop()
            ?.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
            .slice(0, 180) || "media";
        if (!seenNames.has(clean)) {
          seenNames.add(clean);
          dedupedEntries.push([entryId, rawName]);
        }
      }

      if (dedupedEntries.length > 0) {
        const uploadStartMs = performance.now();
        let uploadedFilesCount = 0;
        let uploadedRawBytes = 0;
        const totalFilesToUpload = dedupedEntries.length;
        const estimatedTotalBytes = Math.max(
          selectedFile.size,
          dedupedEntries.length * 1024,
        );

        const formatProgress = () => {
          const elapsedSec = Math.max(
            0.1,
            (performance.now() - uploadStartMs) / 1000,
          );
          const mbPerSec = uploadedRawBytes / (1024 * 1024) / elapsedSec;
          return `Uploading media (${uploadedFilesCount}/${totalFilesToUpload} files · ${mbPerSec.toFixed(1)} MB/s · ${elapsedSec.toFixed(1)}s)...`;
        };

        const decompressEntryBytes = async (entryId: string) => {
          const entry = zip.file(entryId);
          if (!entry) return null;
          let bytes = await entry.async("uint8array");
          if (
            bytes.length >= 4 &&
            bytes[0] === 0x28 &&
            bytes[1] === 0xb5 &&
            bytes[2] === 0x2f &&
            bytes[3] === 0xfd
          ) {
            try {
              bytes = fzstd.decompress(bytes);
            } catch {
              // Keep original bytes if zstd frame is non-standard
            }
          }
          return bytes;
        };

        const fetchWithRetry = async <T,>(
          fn: () => Promise<T>,
          attempts = 3,
          delays = [500, 1500, 3000],
        ): Promise<T> => {
          let lastErr: unknown;
          for (let attempt = 0; attempt < attempts; attempt++) {
            try {
              return await fn();
            } catch (err) {
              lastErr = err;
              if (attempt < attempts - 1) {
                await new Promise((r) => setTimeout(r, delays[attempt] ?? 1500));
              }
            }
          }
          throw lastErr;
        };

        type PresignResponse =
          | {
              mode: "worker";
              workerUrl: string;
              token: string;
              mediaBase: string;
              maxBatchFiles: number;
              maxBatchBytes: number;
            }
          | {
              mode: "presigned";
              mediaBase: string;
              uploads: {
                name: string;
                safeName: string;
                url: string;
                contentType: string;
              }[];
            }
          | {
              mode: "batch";
              forceBackup: boolean;
              reason: string;
              errorMessage?: string;
            };

        const requestPresignChunk = async (
          filenames: string[],
          skipQuotaCheck: boolean,
          forcePresigned = false,
        ): Promise<PresignResponse> => {
          const resp = await fetch("/api/anki/presign-media", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              importId,
              filenames,
              estimatedTotalBytes,
              estimatedTotalObjects: dedupedEntries.length,
              skipQuotaCheck,
              forcePresigned,
            }),
          });
          if (!resp.ok) {
            return {
              mode: "batch",
              forceBackup: false,
              reason: `PRESIGN_HTTP_${resp.status}`,
            };
          }
          return (await resp.json()) as PresignResponse;
        };

        setProgressMsg(
          `Preparing ${totalFilesToUpload} media files for fast upload...`,
        );

        let directSucceeded = false;
        let forceBatchBackup = false;

        try {
          const PRESIGN_CHUNK = 400;
          const firstNames = dedupedEntries
            .slice(0, PRESIGN_CHUNK)
            .map(([, realName]) => realName);
          let activePlan = await requestPresignChunk(firstNames, false);

          if (activePlan.mode === "worker") {
            const workerUrl = activePlan.workerUrl;
            const workerToken = activePlan.token;
            const workerMediaBase = activePlan.mediaBase;
            const maxFiles = Math.max(1, activePlan.maxBatchFiles || 40);
            const maxBytes = Math.max(100_000, activePlan.maxBatchBytes || 2_500_000);

            const slices: Array<Array<[string, string]>> = [];
            for (let i = 0; i < dedupedEntries.length; i += maxFiles) {
              slices.push(dedupedEntries.slice(i, i + maxFiles));
            }

            const uploadWorkerSlice = async (slice: Array<[string, string]>) => {
              const items: WorkerBatchFileInput[] = [];
              for (const [entryId, rawName] of slice) {
                const rawBytes = await decompressEntryBytes(entryId);
                if (!rawBytes) continue;
                items.push({
                  name: rawName,
                  contentType: detectAnkiMediaContentType(rawName),
                  bytes: rawBytes,
                });
              }
              if (items.length === 0) return;

              const subBatches: WorkerBatchFileInput[][] = [];
              let currentSub: WorkerBatchFileInput[] = [];
              let currentSubBytes = 0;
              for (const item of items) {
                if (
                  currentSub.length > 0 &&
                  currentSubBytes + item.bytes.byteLength > maxBytes
                ) {
                  subBatches.push(currentSub);
                  currentSub = [];
                  currentSubBytes = 0;
                }
                currentSub.push(item);
                currentSubBytes += item.bytes.byteLength;
              }
              if (currentSub.length > 0) subBatches.push(currentSub);

              for (const sub of subBatches) {
                const packed = packWorkerMediaBatch(workerToken, sub);
                await fetchWithRetry(
                  async () => {
                    const postResp = await fetch(workerUrl, {
                      method: "POST",
                      headers: { "Content-Type": "text/plain" },
                      body: packed.slice().buffer,
                    });
                    if (!postResp.ok) {
                      throw new Error(`Worker batch failed (${postResp.status})`);
                    }
                  },
                  3,
                  [300, 1000, 2500],
                );
                const subBytes = sub.reduce(
                  (sum, item) => sum + item.bytes.byteLength,
                  0,
                );
                uploadedFilesCount += sub.length;
                uploadedRawBytes += subBytes;
                setProgressMsg(formatProgress());
              }
            };

            let workerProbeOk = false;
            try {
              if (slices.length > 0) {
                await uploadWorkerSlice(slices[0]!);
              }
              workerProbeOk = true;
            } catch {
              workerProbeOk = false;
              uploadedFilesCount = 0;
              uploadedRawBytes = 0;
            }

            if (workerProbeOk) {
              const WORKER_CONCURRENCY = 6;
              const remainingSlices = slices.slice(1);
              let nextSliceIdx = 0;
              const workers = Array.from(
                { length: Math.min(WORKER_CONCURRENCY, remainingSlices.length) },
                async () => {
                  while (nextSliceIdx < remainingSlices.length) {
                    const idx = nextSliceIdx++;
                    const slice = remainingSlices[idx];
                    if (slice) {
                      await uploadWorkerSlice(slice);
                    }
                  }
                },
              );
              await Promise.all(workers);
              resolvedMediaBase = workerMediaBase;
              directSucceeded = true;
            } else {
              // Fall back seamlessly to Presigned PUT -> Server Batch if Worker probe fails
              activePlan = await requestPresignChunk(firstNames, true, true);
            }
          }

          if (!directSucceeded && activePlan.mode === "batch") {
            forceBatchBackup = Boolean(activePlan.forceBackup);
          } else if (
            !directSucceeded &&
            activePlan.mode === "presigned" &&
            activePlan.uploads.length > 0
          ) {
            const firstEntry = dedupedEntries[0]!;
            const firstUpload = activePlan.uploads[0]!;
            const firstBytes = await decompressEntryBytes(firstEntry[0]);

            // Probe entry #0 directly against R2 before fanning out all chunks
            let probeOk = false;
            if (firstBytes) {
              try {
                const probeResp = await fetch(firstUpload.url, {
                  method: "PUT",
                  headers: { "Content-Type": firstUpload.contentType },
                  body: firstBytes.slice().buffer,
                });
                probeOk = probeResp.ok;
              } catch {
                probeOk = false;
              }
            } else {
              probeOk = true;
            }

            if (probeOk) {
              resolvedMediaBase = activePlan.mediaBase;
              uploadedFilesCount = 1;
              uploadedRawBytes += firstBytes?.byteLength ?? 0;
              setProgressMsg(formatProgress());

              const allUploads = [...activePlan.uploads];
              for (
                let offset = PRESIGN_CHUNK;
                offset < dedupedEntries.length;
                offset += PRESIGN_CHUNK
              ) {
                const chunkNames = dedupedEntries
                  .slice(offset, offset + PRESIGN_CHUNK)
                  .map(([, realName]) => realName);
                const chunkRes = await requestPresignChunk(
                  chunkNames,
                  true,
                  true,
                );
                if (chunkRes.mode !== "presigned") {
                  throw new Error(
                    chunkRes.mode === "batch"
                      ? chunkRes.errorMessage || "Presign failed mid-stream"
                      : "Presign failed mid-stream",
                  );
                }
                allUploads.push(...chunkRes.uploads);
              }

              const DIRECT_CONCURRENCY = 24;
              let nextIdx = 1;
              const workers = Array.from(
                {
                  length: Math.min(
                    DIRECT_CONCURRENCY,
                    Math.max(0, dedupedEntries.length - 1),
                  ),
                },
                async () => {
                  while (nextIdx < dedupedEntries.length) {
                    const idx = nextIdx++;
                    const entryPair = dedupedEntries[idx];
                    const uploadTarget = allUploads[idx];
                    if (!entryPair || !uploadTarget) continue;

                    const rawBytes = await decompressEntryBytes(entryPair[0]);
                    if (rawBytes) {
                      await fetchWithRetry(
                        async () => {
                          const putResp = await fetch(uploadTarget.url, {
                            method: "PUT",
                            headers: {
                              "Content-Type": uploadTarget.contentType,
                            },
                            body: rawBytes.slice().buffer,
                          });
                          if (!putResp.ok) {
                            throw new Error(
                              `Direct upload failed (${putResp.status}) for ${uploadTarget.safeName}`,
                            );
                          }
                        },
                        3,
                        [250, 800, 2000],
                      );
                      uploadedRawBytes += rawBytes.byteLength;
                    }
                    uploadedFilesCount += 1;
                    if (
                      uploadedFilesCount % 10 === 0 ||
                      uploadedFilesCount === totalFilesToUpload
                    ) {
                      setProgressMsg(formatProgress());
                    }
                  }
                },
              );
              await Promise.all(workers);
              directSucceeded = true;
            }
          }
        } catch {
          // Probe or presigned direct upload failed -> fall back cleanly to server batch upload
          directSucceeded = false;
          uploadedFilesCount = 0;
          uploadedRawBytes = 0;
        }

        if (!directSucceeded) {
          type UploadBatch = { name: string; base64: string }[];
          const batches: UploadBatch[] = [];
          let currentBatch: UploadBatch = [];
          let currentBatchBytes = 0;
          const maxBatchBytes = 2.0 * 1024 * 1024;
          const maxBatchFiles = 45;
          let batchEstimatedBytes = 0;

          for (const [entryId, realName] of dedupedEntries) {
            const entry = zip.file(entryId);
            if (!entry) continue;
            const base64 = await entry.async("base64");
            const approxBytes = base64.length;
            if (approxBytes > 2.8 * 1024 * 1024) continue;
            batchEstimatedBytes += Math.floor((approxBytes * 3) / 4);

            if (
              currentBatch.length > 0 &&
              (currentBatch.length >= maxBatchFiles ||
                currentBatchBytes + approxBytes > maxBatchBytes)
            ) {
              batches.push(currentBatch);
              currentBatch = [];
              currentBatchBytes = 0;
            }
            currentBatch.push({ name: realName, base64 });
            currentBatchBytes += approxBytes;
          }
          if (currentBatch.length > 0) {
            batches.push(currentBatch);
          }

          if (batches.length > 0) {
            const totalBatchFiles = batches.reduce(
              (sum, b) => sum + b.length,
              0,
            );
            const batchStartMs = performance.now();
            uploadedFilesCount = 0;
            let batchUploadedBytes = 0;

            const postBatch = async (
              batch: UploadBatch,
              opts: {
                estimatedBytes?: number;
                estimatedObjects?: number;
                skipQuotaCheck?: boolean;
                forceBackup?: boolean;
              },
            ) =>
              fetchWithRetry(async () => {
                const resp = await fetch("/api/anki/upload-media-batch", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    importId,
                    files: batch,
                    estimatedTotalBytes: opts.estimatedBytes,
                    estimatedTotalObjects: opts.estimatedObjects,
                    skipQuotaCheck: opts.skipQuotaCheck,
                    forceBackup: opts.forceBackup,
                  }),
                });
                if (!resp.ok) {
                  const errBody = (await resp.json().catch(() => null)) as {
                    error?: string;
                  } | null;
                  throw new Error(
                    errBody?.error
                      ? `Media batch upload failed (${resp.status}): ${errBody.error}`
                      : `Media batch upload failed (${resp.status}). Please retry or check storage settings.`,
                  );
                }
                const data = (await resp.json()) as {
                  mediaBase?: string | null;
                  provider?: "s3" | "github" | "local";
                };
                if (data.mediaBase) resolvedMediaBase = data.mediaBase;
                uploadedFilesCount += batch.length;
                batchUploadedBytes += batch.reduce(
                  (sum, item) => sum + Math.floor((item.base64.length * 3) / 4),
                  0,
                );
                const elapsedSec = Math.max(
                  0.1,
                  (performance.now() - batchStartMs) / 1000,
                );
                const mbPerSec = batchUploadedBytes / (1024 * 1024) / elapsedSec;
                setProgressMsg(
                  `Uploading media (${uploadedFilesCount}/${totalBatchFiles} files · ${mbPerSec.toFixed(1)} MB/s · ${elapsedSec.toFixed(1)}s)...`,
                );
                return data;
              });

            setProgressMsg(
              `Uploading media (0/${totalBatchFiles} files)...`,
            );
            const firstRes = await postBatch(batches[0]!, {
              estimatedBytes: batchEstimatedBytes,
              estimatedObjects: totalBatchFiles,
              forceBackup: forceBatchBackup,
            });
            const useBackupForRest =
              forceBatchBackup || firstRes.provider === "github";

            // GitHub updates heads/main sequentially (1 worker) to prevent 409/422 conflicts; S3 uses 4 workers
            const remaining = batches.slice(1);
            const CONCURRENCY = useBackupForRest ? 1 : 4;
            let nextIdx = 0;
            const workers = Array.from(
              { length: Math.min(CONCURRENCY, remaining.length) },
              async () => {
                while (nextIdx < remaining.length) {
                  const idx = nextIdx++;
                  const batch = remaining[idx];
                  if (batch) {
                    await postBatch(batch, {
                      forceBackup: useBackupForRest,
                      skipQuotaCheck: !useBackupForRest,
                    });
                  }
                }
              },
            );
            await Promise.all(workers);
          }
        }
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
