import {
  detectMediaContentType,
  evaluateS3QuotaHeadroom,
  sanitizeMediaFileName,
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
});
