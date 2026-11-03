# Complete Ndovera question-bank project

Scope: all supported examination systems and source-justified class/subject banks,
including BECE discovered in the app catalogue. This supersedes the earlier
Mathematics-only queue. **The project is incomplete. Nothing is academically approved.**

## Reproduce the checkpoint

From the repository root, using Python 3.10+ with no third-party packages:

```sh
python -m unittest discover -s question-data/tests -v
python question-data/tools/audit.py --write --strict-new
git diff --check
```

Read `audits/completion-dashboard.md`, the CSV dashboard, objective coverage CSV,
and machine-readable `audits/completion-dashboard.json`. The JSON contains every
file checksum, question-level exception, similarity group and unresolved scope.
Run `--strict-all` to expose the legacy backlog; it is expected to fail until
that backlog is remediated. `--strict-new` enforces the gate on schema-version-2
batches while still reporting legacy errors. A passing new-batch gate never
means the whole collection passes.

## Counting policy

- Raw means actual array entries, not declared file counts or historic trackers.
- Valid drafts have required fields, registered objective mappings, consistent
  marking totals and answer references, and no unresolved similarity holds.
- Every member of a duplicate/numerical-template/near-duplicate group is held.
  No arbitrary first member is silently certified as educationally distinct.
- Numeric-template and token similarity flags are conservative review candidates,
  not proven plagiarism. Cross-examination reuse is held globally too.
- Answer-option matching does not establish answer truth. Arithmetic checks cover
  explicit Fraction-based claims, parseable legacy determinants, linear definite
  integrals and selected cubic derivatives. Other answers need academic review.
  Claims verify their stated arithmetic, not automatic extraction of word problems.
- Reviewed is zero until an independent academic reviewer supplies evidence.
  This tool deliberately does not implement an approval or publication workflow.
- Registered targets exclude unresolved class-subject lists and future subjects.
  Their absence is a scope blocker, not permission to declare completion.
- Objective counts show represented author-proposed objectives, not a complete
  syllabus percentage. Do not infer completeness from question totals.

## Existing architecture and compatibility

Keep batch JSON in `question-data/original-*.json`. Existing v1 files are
preserved as evidence; new batches use v2 and the same core question fields.
`specifications/registry.json` versions source evidence, bank scope and learning
objectives. Added fields preserve subtopics, cognitive demand and review status.
Source compilations remain user-supplied references, not official specifications.

The application normalises unknown question types to MCQ, so legacy `structured`
records cannot be imported safely without a tested adapter to `longanswer` or
`essay`, `score=maxMarks`, and rubric/objective preservation in metadata.
Do not import these files directly or rely on the application's default
`approved` status. No runtime application, deployment, or D1 changes are included.

The app has database-held curriculum/specification records and runtime-generated
reasoning/worksheet banks. This offline audit does not access tenant databases.
Generated variants and their advertised 1,000-per-class counts are not counted
as independently authored, reviewed exam questions. Dart and TypeScript engine
ports are separate representations, not additional original-question counts.

## Resume without duplicating work

1. Fetch `question-bank/complete-bank-development` and run the commands above.
2. Inspect `audits/checkpoint.json` and `audits/audit-trail.jsonl`.
3. Resolve the highest-priority source/format gaps in the registry. Do not
   invent NERDC terms/classes or IGCSE syllabus codes from broad subject names.
4. Add a substantial, hand-authored batch prioritising missing objectives and
   subjects. Use existing objective IDs only where genuinely applicable; extend
   the register with explicit provenance and pending review when necessary.
5. Run strict-new validation, adjudicate all new similarity flags, and test any
   changed validator logic. Never remove a flag merely to increase a count.
6. Regenerate reports, append the audit trail and update the checkpoint. Commit
   each validated logical batch on this branch. Verify the remote commit SHA.
7. Continue through other subjects/exams. No approval is needed for the next
   authorised data batch; do not restrict development to Mathematics.

Do not create automatic deployments, production imports, or academic sign-offs.
Execution is bounded by each run; this checkpoint is resumable, not a claim that
a background worker is running after the session ends.

## IGCSE qualification evidence

Batch 029 selects Biology **0610 v3** and Chemistry **0620 v2**, both for
2026–2028. Its 100 drafts use Extended, which includes Core and Supplement.
Core-only suitability and exact content-objective codes remain unreviewed.
Paper-style labels distinguish theory from written practical-planning/data tasks;
these do not claim that a learner has performed a laboratory experiment.
The validator checks code/year/version/tier links and rejects MCQ practical
items for these science qualifications. Source retrieval is not academic approval.
