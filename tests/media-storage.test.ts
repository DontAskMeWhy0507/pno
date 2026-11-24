import { S3Client } from "@aws-sdk/client-s3";
import {
  createPresignedMediaUploads,
  detectMediaContentType,
  evaluateS3QuotaHeadroom,
  formatSafeStorageError,
  sanitizeMediaFileName,
  uploadFilesToS3,
  uploadMediaBatchWithDiagnostics,
} from "../packages/images/server/media-storage";
import { getAnkiFallbackMediaUrl } from "../packages/lib/src/anki/media-fallback";

describe("Media Storage, Hard Quota Guard & CDN Fallback", () => {
  test("detectMediaContentType resolves audio and image MIME types accurately", () => {
    expect(detectMediaContentType("crust.mp3")).toBe("audio/mpeg");
    expect(detectMediaContentType("voice.WAV")).toBe("audio/wav");
    expect(detectMediaContentType("photo.webp")).toBe("image/webp");
    expect(detectMediaContentType("pic.jpeg")).toBe("image/jpeg");
    expect(detectMediaContentType("unknown.bin")).toBe(
      "application/octet-stream",
    );
  });

  test("sanitizeMediaFileName strips unsafe path traversal and control characters", () => {
    expect(sanitizeMediaFileName("C:\\fakepath\\hello<world>.mp3")).toBe(
      "hello_world_.mp3",
    );
  });

  test("evaluateS3QuotaHeadroom allows uploads under 90% free-tier cap and blocks at cap", () => {
    const ok = evaluateS3QuotaHeadroom({
      currentBytes: 1_000_000_000,
      currentObjects: 5_000,
      incomingBytes: 50_000_000,
      incomingObjects: 100,
      maxBytes: 4_500_000_000,
      maxObjects: 90_000,
    });
    expect(ok.allowed).toBe(true);
    expect(ok.projectedBytes).toBe(1_050_000_000);

    const byteBlocked = evaluateS3QuotaHeadroom({
      currentBytes: 4_480_000_000,
      currentObjects: 5_000,
      incomingBytes: 30_000_000,
      incomingObjects: 10,
      maxBytes: 4_500_000_000,
      maxObjects: 90_000,
    });
    expect(byteBlocked.allowed).toBe(false);
    expect(byteBlocked.reason).toBe("BYTE_QUOTA_REACHED");

    const objectBlocked = evaluateS3QuotaHeadroom({
      currentBytes: 500_000_000,
      currentObjects: 89_980,
      incomingBytes: 1024,
      incomingObjects: 25,
      maxBytes: 4_500_000_000,
      maxObjects: 90_000,
    });
    expect(objectBlocked.allowed).toBe(false);
    expect(objectBlocked.reason).toBe("OBJECT_QUOTA_REACHED");
  });

  test("getAnkiFallbackMediaUrl maps primary S3 URLs to GitHub jsDelivr and jsDelivr to raw mirror", () => {
    expect(
      getAnkiFallbackMediaUrl(
        "https://pno-media.fly.storage.tigris.dev/anki/imports/abc123/crust.mp3",
      ),
    ).toBe(
      "https://cdn.jsdelivr.net/gh/DontAskMeWhy0507/quenti-media@main/anki/imports/abc123/crust.mp3",
    );

    expect(
      getAnkiFallbackMediaUrl(
        "https://cdn.jsdelivr.net/gh/DontAskMeWhy0507/quenti-media@main/anki/imports/abc123/crust.mp3",
      ),
    ).toBe(
      "https://raw.githubusercontent.com/DontAskMeWhy0507/quenti-media/main/anki/imports/abc123/crust.mp3",
    );

    expect(getAnkiFallbackMediaUrl("/api/anki/media/crust.mp3")).toBeNull();
    expect(getAnkiFallbackMediaUrl("data:audio/mp3;base64,AAAA")).toBeNull();
  });

  describe("R2 Quota Guard, Presigned PUT, skipQuotaCheck & Safe Error Diagnostics", () => {
    const origEnv = { ...process.env };

    beforeEach(() => {
      process.env.MEDIA_S3_ENDPOINT =
        "https://f23d2f4a1f2728d72a0d92c74cd8b9a4.r2.cloudflarestorage.com";
      process.env.MEDIA_S3_REGION = "auto";
      process.env.MEDIA_S3_BUCKET = "pno";
      process.env.MEDIA_S3_ACCESS_KEY_ID = "AKIA_TEST_KEY_ID_SECRET";
      process.env.MEDIA_S3_SECRET_ACCESS_KEY = "SUPER_SECRET_ACCESS_KEY_VALUE";
      process.env.MEDIA_S3_PUBLIC_URL =
        "https://pub-0fe24510262b429d9dfda48feefbedba.r2.dev";
      delete process.env.GITHUB_MEDIA_TOKEN;
      delete process.env.MEDIA_S3_MAX_BYTES;
      delete process.env.MEDIA_S3_MAX_OBJECTS;
    });

    afterEach(() => {
      jest.restoreAllMocks();
      process.env = { ...origEnv };
    });

    test("skipQuotaCheck: true skips ListObjectsV2Command and uploads directly", async () => {
      const sentCommands: string[] = [];
      jest
        .spyOn(S3Client.prototype, "send")
        .mockImplementation(async (cmd: { constructor: { name: string } }) => {
          sentCommands.push(cmd.constructor.name);
          return {};
        });

      const res = await uploadFilesToS3(
        [{ name: "25_3482.mp3", content: Buffer.from("mp3-bytes") }],
        "anki/imports/skipcheck",
        { skipQuotaCheck: true },
      );

      expect(res?.mediaBase).toBe(
        "https://pub-0fe24510262b429d9dfda48feefbedba.r2.dev/anki/imports/skipcheck",
      );
      expect(sentCommands).toEqual(["PutObjectCommand"]);
      expect(sentCommands).not.toContain("ListObjectsV2Command");
    });

    test("estimatedTotalObjects enforces 500k R2 object quota guard even on small first batch", async () => {
      jest
        .spyOn(S3Client.prototype, "send")
        .mockImplementation(async (cmd: { constructor: { name: string } }) => {
          if (cmd.constructor.name === "ListObjectsV2Command") {
            return {
              Contents: [{ Size: 1024 }],
              IsTruncated: false,
            };
          }
          return {};
        });

      // Bucket currently has 1 object, incoming batch has 1 file, but total deck objects = 500,000 -> exceeds 500,000 cap
      const res = await uploadFilesToS3(
        [{ name: "sample.mp3", content: Buffer.from("abc") }],
        "anki/imports/objcap",
        { estimatedTotalObjects: 500_000 },
      );

      expect(res?.blockedReason).toBe("OBJECT_QUOTA_REACHED");
    });

    test("createPresignedMediaUploads generates SigV4 presigned PUT URLs under 9 GB and falls back over 9 GB", async () => {
      let bucketSize = 1_000_000;
      jest
        .spyOn(S3Client.prototype, "send")
        .mockImplementation(async (cmd: { constructor: { name: string } }) => {
          if (cmd.constructor.name === "ListObjectsV2Command") {
            return {
              Contents: [{ Size: bucketSize }],
              IsTruncated: false,
            };
          }
          return {};
        });

      const underCap = await createPresignedMediaUploads({
        filenames: ["25_3482.mp3", "07_3123.jpg"],
        prefix: "anki/imports/presigntest1",
        estimatedTotalBytes: 36_500_000,
        estimatedTotalObjects: 2_400,
      });

      expect(underCap.mode).toBe("presigned");
      if (underCap.mode === "presigned") {
        expect(underCap.mediaBase).toBe(
          "https://pub-0fe24510262b429d9dfda48feefbedba.r2.dev/anki/imports/presigntest1",
        );
        expect(underCap.uploads).toHaveLength(2);
        expect(underCap.uploads[0]!.contentType).toBe("audio/mpeg");
        expect(underCap.uploads[1]!.contentType).toBe("image/jpeg");
        expect(underCap.uploads[0]!.url).toContain("X-Amz-Signature=");
        expect(underCap.uploads[0]!.url).toContain("r2.cloudflarestorage.com");
      }

      // Now simulate bucket nearly full (> 9 GB with incoming bytes) with a fresh endpoint key to bypass 5m cache
      process.env.MEDIA_S3_BUCKET = "pno-full";
      bucketSize = 8_990_000_000;
      const overCap = await createPresignedMediaUploads({
        filenames: ["big.mp3"],
        prefix: "anki/imports/presigntest2",
        estimatedTotalBytes: 20_000_000,
        estimatedTotalObjects: 1,
      });

      expect(overCap).toEqual({
        mode: "batch",
        forceBackup: true,
        reason: "BYTE_QUOTA_REACHED",
      });
    });

    test("formatSafeStorageError and diagnostics propagate failures without leaking secrets", async () => {
      const sanitized = formatSafeStorageError(
        new Error(
          "Upload failed with Bearer ghp_secret123 and X-Amz-Signature=deadbeef12345",
        ),
      );
      expect(sanitized).not.toContain("ghp_secret123");
      expect(sanitized).not.toContain("deadbeef12345");
      expect(sanitized).toContain("Bearer [redacted]");
      expect(sanitized).toContain("X-Amz-*=[redacted]");

      jest.spyOn(S3Client.prototype, "send").mockImplementation(async () => {
        throw Object.assign(new Error("AccessDenied to bucket pno"), {
          name: "AccessDenied",
          $metadata: { httpStatusCode: 403 },
        });
      });

      const diag = await uploadMediaBatchWithDiagnostics(
        [{ name: "a.mp3", content: Buffer.from("x") }],
        "anki/imports/errtest",
        { skipQuotaCheck: true },
      );

      expect(diag.result).toBeNull();
      expect(diag.s3Configured).toBe(true);
      expect(diag.githubConfigured).toBe(false);
      expect(diag.s3Error).toContain("AccessDenied");
      expect(diag.s3Error).toContain("HTTP 403");
      expect(diag.s3Error).not.toContain("SUPER_SECRET_ACCESS_KEY_VALUE");
    });
  });
});
