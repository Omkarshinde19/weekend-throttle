import { forwardRef } from "react";

const LATIN = ["I", "N", "D", "I", "A"];
// Devanagari is split into grapheme clusters so the matras stay attached: भा · र · त
const DEVA = ["भा", "र", "त"];

/**
 * INDIA and भारत stacked on top of each other. The hero cross-fades them glyph by glyph;
 * the weather scene reads `data-variant` / `data-active` to know which glyphs snow can sit on.
 */
export const Wordmark = forwardRef<HTMLDivElement>((_, ref) => (
  <div ref={ref} className="wordmark" data-snow-text data-variant="latin">
    <h1 className="wordmark__latin" aria-label="India">
      {LATIN.map((ch, i) => (
        <span key={i} className="glyph" data-glyph data-set="latin" data-active="true" aria-hidden>
          {ch}
        </span>
      ))}
    </h1>
    <p className="wordmark__deva" lang="hi" aria-label="Bharat">
      {DEVA.map((ch, i) => (
        <span key={i} className="glyph" data-glyph data-set="deva" data-active="false" aria-hidden>
          {ch}
        </span>
      ))}
    </p>
  </div>
));
