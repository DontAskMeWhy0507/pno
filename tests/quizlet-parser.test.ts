import {
  parseQuizletExportText,
  validateQuizletUrl,
} from "../packages/lib/src/quizlet/parser";

describe("Quizlet Parser & URL Validator", () => {
  test("handles Windows CRLF line endings cleanly", () => {
    const raw = "ephemeral\tlasting for a very short time\r\nubiquitous\tfound everywhere\r\n";
    const parsed = parseQuizletExportText(raw);
    expect(parsed).toEqual([
      { word: "ephemeral", definition: "lasting for a very short time" },
      { word: "ubiquitous", definition: "found everywhere" },
    ]);
  });

  test("supports custom whitespace delimiter (' - ') reliably", () => {
    const raw = "alpha - first letter\nbeta - second letter";
    const parsed = parseQuizletExportText(raw, {
      termDelimiter: "custom",
      customTermDelimiter: " - ",
    });
    expect(parsed).toEqual([
      { word: "alpha", definition: "first letter" },
      { word: "beta", definition: "second letter" },
    ]);
  });

  test("does not falsely split on email addresses containing '@' when tab-delimited", () => {
    const raw =
      "support@quenti.io\tOfficial Quenti support address\nadmin@school.edu\tSchool admin contact";
    const parsed = parseQuizletExportText(raw);
    expect(parsed).toEqual([
      {
        word: "support@quenti.io",
        definition: "Official Quenti support address",
      },
      { word: "admin@school.edu", definition: "School admin contact" },
    ]);
  });

  test("validateQuizletUrl rejects non-HTTPS, localhost, and SSRF IP URLs", () => {
    expect(() =>
      validateQuizletUrl("http://quizlet.com/123456/test-flash-cards/"),
    ).toThrow();
    expect(() =>
      validateQuizletUrl("https://localhost:3000/123456/test/"),
    ).toThrow();
    expect(() =>
      validateQuizletUrl("https://127.0.0.1/123456/test/"),
    ).toThrow();
    expect(() =>
      validateQuizletUrl("https://169.254.169.254/latest/meta-data/"),
    ).toThrow();
    expect(() =>
      validateQuizletUrl("https://quizlet.com/login"),
    ).toThrow();

    expect(
      validateQuizletUrl("https://quizlet.com/123456/biology-terms/#section"),
    ).toBe("https://quizlet.com/123456/biology-terms/");
  });
});
