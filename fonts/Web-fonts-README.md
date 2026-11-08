# Web fonts

The website serves local WOFF2 fonts to avoid third-party stylesheet failures.

- `SourceHanSerifKR-Web.woff2`: a subset of the existing Source Han Serif KR variable font, covering the codebase's fixed Korean and Chinese copy, dates and punctuation. Internal family name: Byeol Serif Web. Original retained locally as `SourceHanSerifKR-VF.otf.woff2`; see `SourceHanSerif-LICENSE.txt`.
- `PretendardVariable-Web.woff2`: a subset of the official Pretendard variable font, including all modern Hangul syllables and the website's additional characters. Internal family name: Byeol Sans Web. See `Pretendard-LICENSE.txt`.

Modified internal names respect the SIL OFL reserved font names. CSS aliases preserve the existing layout's font-family declarations. Font weights and glyph outlines are retained. If fixed Korean/Chinese copy is added to a serif element, regenerate the subset or restore the full original font source.

Official Pretendard source: https://github.com/orioncactus/pretendard
