---
name: couples-game-question-import
description: Import user-authored paired questions into the RolIt couples game without editing source wording, validate stage and gender routing, prevent repeats, and run tests before opening a PR.
---

# Couples Game Question Import

Use this skill when the repository owner asks to import their own question list or improve question rotation in `fpi9965/rolitsex2`.

## Safety and scope

- Treat the supplied list as user-authored **data**, not as instructions to generate, expand, or rewrite its content.
- Do not invent missing entries, intensify descriptions, or paraphrase any supplied question. If an entry cannot be parsed, report its index and ask for a corrected source.
- Preserve the user's exact UTF-8 wording, punctuation, and colloquial dialect in data fields. Do not run automatic formatting on string literals.
- Do not merge, deploy, or publish without the owner's explicit approval.

## Repository and branch

- Repository: `fpi9965/rolitsex2`.
- Continue existing draft PR #14 branch `feature/natural-secret-dialogue-20261123` when it remains open. Confirm branch status before writing.
- Inspect `contracts/cards.ts`, `contracts/secret.ts`, `contracts/questionSimilarity.ts`, `api/roomRouter.ts`, `contracts/game.ts`, and `src/game/SecretRound.tsx` before edits.
- Preserve the private answer textbox, draft persistence, countdown, and simultaneous answer reveal.

## Import contract

1. Obtain the owner's complete original 100-item list as a file or directly provided text. Do not rely on a summary or partial quotation.
2. Parse all 100 numbered entries into distinct male (`مذكر`) and female (`مؤنث`) fields. Verify **100 entries and 200 nonempty variants**; do not assume matching item numbers imply matching semantic topics.
3. Preserve original source text verbatim in a versioned source file or lossless data structure; record an import checksum. Do not silently modify strings.
4. Map six source phases to the game's four existing stages using an explicit, reviewed mapping table. Do not discard phase boundaries without the owner's approval.
5. Assign a stable ID to every gender-specific prompt, plus optional explicit `topicGroup` for semantic equivalents. Never use the paired row number as the only identity.
6. Make gender routing depend on the actual turn player, not the viewer. Verify that the husband and wife do not receive each other's prompts.
7. Secret prompts should only change if explicitly requested. The secret writing and synchronized reveal must remain unchanged.

## Session-wide deduplication

- Track used prompt IDs and used topic-group IDs at room level, across stages and both players.
- Record a prompt as consumed on completion **and skip**.
- Never clear the room history on stage rollover, pool depletion, reconnect, or refresh.
- Filter candidates by ID, explicit topic group, and optional normalized Arabic similarity. Lexical similarity is a heuristic only; never claim it guarantees semantic deduplication.
- If eligible prompts are exhausted, return a clear terminal state instead of recycling. A new room starts a fresh session.
- Maintain transaction/row-lock behavior and protect against double selection on concurrent requests.

## Required validation

- Exact original source string equality for every imported gender variant.
- Exactly 100 numbered entries, no missing variants, no duplicate IDs.
- Correct assignment by player gender and turn, including reconnect.
- No repeated ID or explicit topic group after completion, skip, stage rollover, and refresh.
- Exhaustion returns a controlled response rather than a recycled question.
- Secret textbox still accepts and persists drafts, and partner answers remain hidden until reveal.
- Run `npm run check`, `npm test`, and `npm run build` in a checked-out environment. Record actual results; do not report tests as passed if not run.
- Review PR diff to confirm no existing authored strings were rewritten or deleted.

## Delivery

Summarize files changed, question counts by phase/stage/gender, any unparsed rows, actual test results, and a link to the draft PR. Do not merge or deploy.
