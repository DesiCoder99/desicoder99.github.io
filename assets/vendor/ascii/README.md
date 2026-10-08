# Earthrise from ascii.rest

Source: https://github.com/bas3line/ascii
Commit: f0eee43fe5ea40d0070c936c5c402627c6ff970a
License: MIT (included in LICENSE)

`earthrise.js` and `mount.js` are the original `src/pieces/earthrise.ts` and
`src/mount.ts` with TypeScript types removed using Node's stripTypeScriptTypes.
They are hosted locally so the landing page needs no third-party runtime or build step.

Devpit adaptations: Earthrise uses a brightness ramp of ASCII punctuation and
letters (` .:;+=xXMW@`) in place of the original halftone dots. The canvas
renderer sizes glyphs to fit square cells without clipping letterforms.
