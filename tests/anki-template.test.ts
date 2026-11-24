import {
  renderAnkiCard,
  extractClozeOrdinals,
  sanitizeAnkiHtml,
  stripFrontSidePrefix,
  extractAnkiAudioSources,
} from "../packages/lib/src/anki/template";
import { scopeAnkiCss } from "../packages/lib/src/anki/presets";

describe("Anki Template & Cloze Parsing Engine", () => {
  test("replaces standard fields {{Field}} with field content", () => {
    const card = renderAnkiCard({
      qfmt: "<div>{{Word}}</div>",
      afmt: "{{FrontSide}}<hr id=answer><div>{{Meaning}}</div>",
      fields: {
        Word: "Ephemeral",
        Meaning: "Lasting for a very short time",
      },
    });

    expect(card.questionHtml).toContain("<div>Ephemeral</div>");
    expect(card.answerHtml).toContain("<div>Lasting for a very short time</div>");
    expect(card.answerHtml).toContain("<div>Ephemeral</div>"); // from FrontSide
  });

  test("handles conditional fields {{#Field}} and {{^Field}}", () => {
    const qfmt = "{{#Example}}<b>Example:</b> {{Example}}{{/Example}}{{^Example}}<i>No example available</i>{{/Example}}";
    
    // When Example is present
    const withExample = renderAnkiCard({
      qfmt,
      afmt: "Back",
      fields: { Example: "He lived an ephemeral life." },
    });
    expect(withExample.questionHtml).toContain("<b>Example:</b> He lived an ephemeral life.");
    expect(withExample.questionHtml).not.toContain("No example available");

    // When Example is empty
    const withoutExample = renderAnkiCard({
      qfmt,
      afmt: "Back",
      fields: { Example: "" },
    });
    expect(withoutExample.questionHtml).not.toContain("<b>Example:</b>");
    expect(withoutExample.questionHtml).toContain("<i>No example available</i>");
  });

  test("extractClozeOrdinals identifies all unique cloze numbers", () => {
    const text = "{{c1::Paris}} is the capital of {{c2::France::country}} and {{c1::City of Light}}.";
    const ordinals = extractClozeOrdinals(text);
    expect(ordinals).toEqual([1, 2]);
  });

  test("renders cloze deletions correctly for front and back", () => {
    const qfmt = "{{cloze:Text}}";
    const afmt = "{{cloze:Text}}<br>{{Extra}}";
    const fields = {
      Text: "Canberra is the capital of {{c1::Australia::country}} (not {{c2::Sydney}}).",
      Extra: "Founded in 1913.",
    };

    // For cloze 1:
    const cardC1 = renderAnkiCard({
      qfmt,
      afmt,
      fields,
      clozeOrdinal: 1,
    });
    // Front: c1 is masked with hint, c2 is unmasked plain text
    expect(cardC1.questionHtml).toContain("Canberra is the capital of [country] (not Sydney).");
    // Back: c1 is highlighted, c2 is plain text
    expect(cardC1.answerHtml).toContain('Canberra is the capital of <span class="anki-cloze">Australia</span> (not Sydney).');
    expect(cardC1.answerHtml).toContain("Founded in 1913.");

    // For cloze 2:
    const cardC2 = renderAnkiCard({
      qfmt,
      afmt,
      fields,
      clozeOrdinal: 2,
    });
    // Front: c1 is plain text, c2 is masked default [...]
    expect(cardC2.questionHtml).toContain("Canberra is the capital of Australia (not [...]).");
    // Back: c2 is highlighted
    expect(cardC2.answerHtml).toContain('Canberra is the capital of Australia (not <span class="anki-cloze">Sydney</span>).');
  });

  test("supports field names with parentheses, dots, and Unicode", () => {
    const card = renderAnkiCard({
      qfmt: "<div>{{Word (Audio)}}</div>{{#Example.Sentence}}<div>{{Example.Sentence}}</div>{{/Example.Sentence}}<div>{{Từ vựng}}</div>",
      afmt: "Back",
      fields: {
        "Word (Audio)": "Hello",
        "Example.Sentence": "Hello world.",
        "Từ vựng": "Xin chào",
      },
    });

    expect(card.questionHtml).toContain("<div>Hello</div>");
    expect(card.questionHtml).toContain("<div>Hello world.</div>");
    expect(card.questionHtml).toContain("<div>Xin chào</div>");
  });

  test("sanitizes dangerous HTML tags and event handlers to prevent XSS", () => {
    const dangerousHtml = '<div>Hello <script>alert("xss")</script><iframe src="evil.com"></iframe><img src="pic.jpg" onerror="alert(1)" onclick="steal()" /></div>';
    const result = sanitizeAnkiHtml(dangerousHtml, "/api/anki/media");

    expect(result.html).not.toContain("<script");
    expect(result.html).not.toContain("alert(");
    expect(result.html).not.toContain("<iframe");
    expect(result.html).not.toContain("onerror");
    expect(result.html).not.toContain("onclick");
    expect(result.html).toContain('src="/api/anki/media/pic.jpg"');
  });

  test("preserves 2+ audio tags on back after stripping FrontSide prefix", () => {
    const mediaPrefix =
      "https://cdn.jsdelivr.net/gh/example/quenti-media@main/anki/imports/abc123";
    const card = renderAnkiCard({
      qfmt: "<div><b>{{Word}}</b><div>{{IPA}}</div>{{WordAudio}}</div>",
      afmt: "{{FrontSide}}<hr id=answer>{{Image}}<div>Example: {{Example}}</div><div>Meaning: {{Meaning}}</div><div>{{ExampleAudio}} {{MeaningAudio}}</div>",
      mediaUrlPrefix: mediaPrefix,
      fields: {
        Word: "crust",
        IPA: "krʌst",
        WordAudio: "[sound:crust.mp3]",
        Image: '<img src="crust.jpg" />',
        Example: "The little boy never ate the crust of his pizza.",
        Meaning: "Crust is the tough outer part of a loaf of bread.",
        ExampleAudio: "[sound:crust_example.mp3]",
        MeaningAudio: "[sound:crust_meaning.mp3]",
      },
    });

    const cleanBack = stripFrontSidePrefix(card.questionHtml, card.answerHtml);
    const frontAudios = extractAnkiAudioSources(card.questionHtml);
    const backAudios = extractAnkiAudioSources(cleanBack);

    expect(frontAudios).toEqual([`${mediaPrefix}/crust.mp3`]);
    expect(backAudios).toEqual([
      `${mediaPrefix}/crust_example.mp3`,
      `${mediaPrefix}/crust_meaning.mp3`,
    ]);
    expect(cleanBack).toContain("crust.jpg");
    expect(cleanBack).not.toContain("crust.mp3");
  });

  test("normalizes <audio> tags and preserves direct URLs without double-prefixing", () => {
    const raw =
      '<audio src="/tests/u1/listening/s1/audio/a.mp3" controls></audio>[sound:https://cdn.example.com/b.mp3]';
    const sanitized = sanitizeAnkiHtml(raw, "/api/anki/media");
    const sources = extractAnkiAudioSources(sanitized.html);

    expect(sources).toEqual([
      "/tests/u1/listening/s1/audio/a.mp3",
      "https://cdn.example.com/b.mp3",
    ]);
  });

  test("scopeAnkiCss scopes selectors and strips dangerous rules", () => {
    const css =
      '@import url("https://evil.com/x.css"); .card { font-size: 20px; } .ipa { color: red; } @media (max-width: 600px) { .word { font-size: 16px; } }';
    const scoped = scopeAnkiCss(css);

    expect(scoped).not.toContain("@import");
    expect(scoped).toContain(".anki-card-surface { font-size: 20px; }");
    expect(scoped).toContain(".anki-card-surface .ipa { color: red; }");
    expect(scoped).toContain(".anki-card-surface .word { font-size: 16px; }");
  });

  test("treats pre-sanitized .anki-audio divs as non-empty in {{#Field}} conditionals", () => {
    const rendered = renderAnkiCard({
      qfmt: "{{Word}}{{#WordAudio}}{{WordAudio}}{{/WordAudio}}",
      afmt: "{{#ExampleAudio}}{{ExampleAudio}}{{/ExampleAudio}}{{#MeaningAudio}}{{MeaningAudio}}{{/MeaningAudio}}",
      fields: {
        Word: "crust",
        WordAudio:
          '<div data-anki-sound="crust.mp3" class="anki-audio" data-src="https://cdn.example.com/crust.mp3"></div>',
        ExampleAudio:
          '<div data-anki-sound="ex.mp3" class="anki-audio" data-src="https://cdn.example.com/ex.mp3"></div>',
        MeaningAudio:
          '<div data-anki-sound="mean.mp3" class="anki-audio" data-src="https://cdn.example.com/mean.mp3"></div>',
      },
    });

    expect(extractAnkiAudioSources(rendered.questionHtml)).toEqual([
      "https://cdn.example.com/crust.mp3",
    ]);
    expect(extractAnkiAudioSources(rendered.answerHtml)).toEqual([
      "https://cdn.example.com/ex.mp3",
      "https://cdn.example.com/mean.mp3",
    ]);
  });
});

