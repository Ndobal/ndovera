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

## BECE and NERDC source checkpoint

The official NECO BECE **2026 timetable** supplies 18 subject/route entries and
observed paper formats. They now appear in the dashboard with no invented
questions or objectives. The evidence is specific to NECO, not every state
BECE. Timetable knowledge alone is insufficient for full syllabus coverage.

The new NERDC Primary 1 and JSS 1 links returned 403 through public retrieval.
Older official Primary 1–3 mathematics and English-introduction PDFs were found,
but their current adoption was not established. Keep these reference sources
separate from verified current class objectives. Do not infer a curriculum
revision date from a search engine crawl or publication timestamp.

Computing verification now checks complete binary-gate truth tables. Arithmetic
and logic checks remain narrower than academic review or program verification.

## History and French checkpoint

Batch 033 adds 25 drafts in each of WAEC/JAMB History and French. French
contains written objective tasks and two original composition models with
author-created practice rubrics. It supplies no listening recordings or oral
performance assessment. History sources include limited museum and archival
crosschecks; full current specification alignment is still pending. These
additions are not complete syllabuses or independently reviewed material.

## Religious Studies checkpoint

Batch 034 adds 25 drafts per WAEC/JAMB CRK and IRK bank, using the existing
registry subject names. It contains 90 four-option questions and 10 WAEC essays
with indicative eight-mark practice guides. Each item has a text reference.
The guides do not reproduce official examination mark scaling. Full current
specifications and independent specialist review remain outstanding. No Arabic
recitation or tajwid performance is assessed by these written questions.

## Literature checkpoint

Batch 035 contains 50 WAEC and 50 JAMB original Literature MCQs, covering general
literary knowledge and unseen appreciation. Its ten stimuli are entirely
original: four prose passages, four poems and two dramatic scenes. The WAEC
prose passages each have 133 whitespace-separated words. These are practice
items, not complete papers or substitutes for prescribed-text essays.

The official WAEC 2026–2030 selected-work list is now registered separately.
`specifications/waec-literature-text-inventory-2026-2030.json` records 21 works
with development status and linked draft questions. It retains printed labels and flags
bibliographic inconsistencies. It is not a question batch or a full objective
matrix. Verify editions and map objectives before adding text-specific items.
Current JAMB/NECO adoption must be verified separately.


Batch 036 adds 25 WAEC and 25 JAMB original context MCQs about Shakespeare’s
*Antony and Cleopatra*, with ten distinct items per act across the two banks.
WAEC Shakespeare practice is objective-only. Primary-text references use the
scene divisions of Project Gutenberg eBook 1534. Commercial examination-edition
equivalence remains unverified. The official WAEC list establishes this work’s
2026–2030 selection; current JAMB adoption is still provisional from the supplied
compilation, not independently established from a current official specification.
The other twenty inventory works remain unstarted; no whole-play completion is
implied by representing each act.

The fifty unseen-appreciation metadata fields in batch 035 were corrected from
`practiceComponent` to `literatureComponent`, preserving question content and
counts. `practiceComponent` retains the existing IGCSE vocabulary. The validator
now checks that vocabulary, Literature subject/component compatibility, primary
content-source registration, required prescribed-text references and the WAEC
Shakespeare objective format. Passing these checks is not academic review.

Batch 037 opens IELTS Academic Reading with 24 original excerpt drills in
three passages. It uses single-answer multiple choice, identifying information,
identifying the writer’s claims, and sentence completion. The passages describe
fictional trials and examples. Judgement labels are recorded as short answers
and completion items have a two-word limit. The batch uses one mark per item.
The official Academic Reading format is registered separately from General
Training, which still needs mapping. Full paper length, timing and band
conversion are outside the excerpt drills.

Batch 038 adds three Academic Reading matching groups using original fictional
passages. The groups cover headings, information and features. Each item carries
the shared passage, instructions and labelled choice bank, plus its group ID
and position. Score one mark per item. The heading group uses each selected
heading once and includes two unused choices. These are standalone draft sets.

Batch 039 introduces 20 General Training Reading drafts across three
section contexts. The original sets use everyday notices, a workplace
instruction excerpt and a general-interest article. Matching labels,
sentence completion and factual judgements use one mark per answer.
Both Reading variants now have separate official format sources and
author-proposed objective mappings. Coverage remains partial.

Batch 040 opens the current TOEFL iBT Reading bank with 21 draft items.
It contains a ten-gap Complete the Words paragraph, two daily-life texts
with three questions each, and one short academic passage with five
questions. The registered ETS sources establish the task families and
sample conventions for the January 2026 redesign. These standalone groups
use one practice mark per item. Adaptive assembly and scaled scoring remain
outside this batch.

Batch 041 starts draft population with two original TOEFL Speaking interview
sets. Use Bloom's taxonomy to plan the cognitive demand of each question
against the source-mapped topic. Across a topic, include foundational and
higher-order tasks where the specification and response format support them.
Choose the demand by what the learner must do, rather than the wording alone.
Listen and Repeat still needs audio. The checkpoint separates unaudited
additions from the last verified dashboard totals.

Batch 042 adds eight TOEFL Speaking interview items on campus exhibitions
and rehearsal spaces. It also reconciles the eight earlier interview drafts
from batch 041 with the automated dashboard. The interview groups use
examiner-read prompts, illustrative answers, and original practice rubrics.
Listen and Repeat remains open pending audio.

Batch 043 opens Cambridge IGCSE Mathematics 0580 using the 2025–2027
version 3 syllabus and its update. The twelve original non-calculator
drafts cover selected objectives C1.13, E1.13 and E2.5. Core and Extended
items have separate tier and paper labels, worked solutions, practice
marking guides and author-assigned Bloom and Cambridge AO mappings.
Legacy entries retain their existing holds and item-level mappings.

Batch 044 opens Cambridge IGCSE Physics 0625 with eight Extended theory
and two written alternative-to-practical drafts on density, flotation
and resultant forces. The 2026–2028 source mapping combines the official
syllabus text with the version 2 update, which records a weblink change.
Each item includes a worked answer, a practice marking guide and a Bloom
level. Core and other syllabus topics remain open.

Batch 045 opens NCEE Mathematics with twenty Primary 6 practice items on
fractions, ratios, percentages and whole-number operations. NECO confirms
the component in Paper I Part A. The older NERDC Primary Six reference guides
provisional topic selection. Full official topic scope, current curriculum
adoption and official option count remain unverified.

Batch 046 opens NCEE National Values Education with twelve original
Primary 6 practice questions on cultural diversity, discipline, and good
neighbourliness. The NECO notice confirms the component. The older
ICPC-hosted teaching guide supports provisional topic selection.
Current NCEE topic specifications and official option count remain open.

Batch 047 opens NCEE Verbal Aptitude with twelve original Primary 6
synonym and antonym practice questions. The NECO notice confirms Paper II
Part B. The older NERDC English Studies reference supports vocabulary
selection provisionally. Official task families and option count remain
unverified. Legacy Verbal Reasoning remains a separate, unmapped label.

Batch 048 adds twelve NCEE Quantitative and Vocational Aptitude drafts.
Six cover fraction relationships and six cover produce packaging and
farm records. The NECO notice confirms Paper II Part A. Older NERDC
Primary Six references guide provisional topics. Full official task scope
remains open, and the legacy Quantitative Reasoning row remains separate.

The 2026 NECO SSCE Internal timetable now supports paper-format entries for
twelve existing NECO subject banks. The registry distinguishes objective,
essay, practical and oral components where applicable. Section 7 of the
registration guidelines lists the separate syllabus. Topic objectives and
option counts remain open, and this evidence is specific to Internal.

Batch 049 opens NECO Economics with eight original structured theory
drafts on market changes and price controls. NECO's 2026 Internal
timetable confirms the essay paper. Historical WAEC examiner materials
provide provisional topic references, and the official NECO objectives
remain open. Marking guides are for practice.

Batch 050 adds twelve original NECO Economics objective drafts on
own-price, income and cross-price elasticity. The official timetable
confirms the objective paper. Topic references are historical WAEC
examiner materials, and four choices are an author practice decision.

Batch 051 opens NECO Financial Accounting with eight original Paper II
practice drafts on bank reconciliation and control accounts. The NECO
timetable supports the theory and practice format. Historical WAEC
examiner materials support provisional topic selection. Marking guides
are for practice and official NECO topic objectives remain open.

Batch 052 adds twelve NECO Financial Accounting objective drafts on
bank reconciliation and control accounts. The timetable confirms Paper III
objective. Topic mapping uses historical WAEC references provisionally,
and the four-option format is for practice.

Batch 053 opens NECO Commerce with six structured and four objective
drafts on warehousing and retail outlets. The official timetable
confirms paper formats. Historical WAEC examiner materials inform
provisional topics. Official NECO topic objectives and option count
remain unverified.

Batch 054 opens NECO Government with six structured and four objective
drafts on delegated legislation and the rule of law. The timetable supports
paper formats. Historical WAEC examiner materials support provisional topics.
Scenarios are fictional, and official NECO objectives remain unverified.

Batch 055 opens NECO Geography with five practical map-skills and five
human geography drafts. The map items supply original measurements or
terrain observations. The human items use original settlement and
migration scenarios. Historical WAEC sources support provisional topics,
while the NECO timetable establishes the distinct paper formats.

Batch 056 opens NECO English Language with six comprehension items and
two summary tasks across two original passages. The NECO timetable
verifies Paper II essay. Historical WAEC examiner feedback provides
provisional reading skill references. The rubric is for practice.
Official NECO section specifications and oral tasks remain open.

Batch 057 adds sixteen NECO English Language objective drafts covering
grammatical structure and vocabulary in context. The NECO timetable
verifies Paper III objective. Historical WAEC feedback informs provisional
skill mapping. Four options are an author practice choice.

Batch 058 opens NECO Biology with six structured and six objective
drafts on ecology and plant nutrition. NECO's 2026 Internal timetable
confirms paper formats. Historical WAEC feedback supports provisional
topic selection. The batch includes written evidence interpretation.
Practical performance and full NECO topic mapping remain open.

Batch 059 opens NECO Chemistry with six structured and six objective
drafts on reaction rates and equilibrium. NECO's 2026 Internal timetable
confirms paper formats. Historical WAEC examiner materials support
provisional topic selection. Practical performance and full NECO
topic mapping remain open.

Batch 060 opens NECO Physics with six structured and six objective
drafts on wave quantities and wave behaviour. The official timetable
confirms the written paper formats. Historical WAEC examiner materials
inform provisional topic mapping. Practical performance remains separate.

Batch 061 opens NECO Agricultural Science with six structured and six
objective drafts on soil management and cropping systems. Historical WAEC
examiner feedback supports provisional topic selection. The 2026 NECO
timetable confirms written paper formats. Official NECO topic objectives
and practical performance tasks remain open.

Batch 062 opens NECO Civic Education with six structured and four
objective drafts on community service and intercommunal relations.
The 2026 Internal timetable confirms the Civic Education papers.
Historical WAEC materials support provisional topics. The batch makes
no claim about a later NECO syllabus or successor subject.

Batch 063 opens NECO General Mathematics with six structured and six
objective drafts on circle geometry, coordinate geometry and probability.
The 2026 Internal timetable verifies the essay and objective papers.
Historical WAEC examiner observations inform provisional topic mapping.
Official NECO topic objectives remain open.

Batch 064 adds original WAEC poetry essays on Once Upon a Time,
Not my Business, She Walks in Beauty and The Stone. The versions in the
official 2026–2030 prescribed-text PDF supply textual evidence. The
practice rubrics draw on historical examiner guidance for text-based
responses. No verses are reproduced. Commercial edition equivalence and
the full current assessment scheme remain open.

Batch 065 adds WAEC theory drafts for four more prescribed works.
The Chaucer questions use only the opening excerpt printed on pages
7–8 of WAEC's 2026–2030 PDF. Digging, Still I Rise and The Telephone Call
use the versions in the same PDF. Objectives and mark allocations are
for practice, with academic review and full scheme verification pending.

Batch 066 adds three theory drafts each for New Tongue, Night, Hearty
Garlands and The Breast of the Sea. All twelve 2026–2030 prescribed
poetry selections now have initial theory drafts. The practice objectives
and rubrics remain pending academic review and current scheme verification.

Batch 067 opens prescribed African prose theory with eight questions on
the published Narrative Landscape Press excerpt of So the Path Does Not
Die. The excerpt ends as Baramusu introduces the story of Musudugu.
Whole-novel coverage, examination edition equivalence and current
assessment details remain open.

Batch 068 adds six original WAEC prose essays using chapter 6 and 9
extracts from To Kill a Mockingbird. The South African DBE archive is
used as a host for primary text. Edition equivalence, whole-novel coverage
and the current WAEC marking scheme remain unverified. The official
Redemption Road excerpt page timed out during retrieval.

Batch 069 adds eight original essays on two excerpts of An Inspector
Calls hosted by Pearson Edexcel. The excerpts provide textual evidence
for practice in close reading. Full-play coverage, examination edition
equivalence and the current WAEC marking scheme remain open.

Batch 070 adds 12 NECO General Mathematics drafts on statistics. The
2026 internal timetable verifies the essay and objective formats.
Historical WAEC examiner materials inform provisional topic mapping.
Official NECO content objectives remain open.

Batch 071 registers NECO Computer Studies and adds ten written database
drafts. The 2026 internal timetable establishes practical, essay and
objective paper formats. Historical WAEC material supports provisional
written objectives. NECO practical task requirements and full objectives
remain open.

Batch 072 adds six hands-on NECO Computer Studies drafts requiring
editable spreadsheet or database artifacts. The official 2026 timetable
confirms Paper I is practical. Historical WAEC examiner reports inform
provisional skills. Exact NECO practical specifications remain open.

Batch 073 registers NECO Further Mathematics and adds eight original
binary-operation questions. The 2026 internal timetable verifies the
essay and objective formats. Historical WAEC examiner evidence supports
provisional topic mapping. Official NECO topic objectives remain open.

Batch 074 registers NECO Christian Religious Studies and adds eight
original drafts on James 2. NECO's 2026 internal timetable confirms the
essay and objective papers. The topic mapping remains provisional.
The Further Mathematics binary-operations source URL was also corrected.

Batch 075 opens NECO Islamic Studies with eight drafts on Al-Ikhlāṣ
and An-Nās. NECO paper formats are verified from the 2026 timetable.
Qur’anic text and historical WAEC examiner materials support provisional
topic mapping. The James 2 registry links were also corrected.

Batch 076 registers NECO Nigerian History and adds eight drafts on
decolonisation. NECO's 2026 timetable verifies essay and objective
formats. Historical WAEC material supports provisional topics. The
Independence Act and UN records anchor the two distinct 1960 events.

Batch 077 registers NECO Foods and Nutrition and adds eight written
drafts on meal planning and hygiene. The official 2026 timetable
verifies practical, essay and objective papers. Topic alignment is
provisional and official practical task requirements remain open.

Batch 078 adds six supervised Foods and Nutrition kitchen practicals.
They require prepared outputs and observed performance. NECO's 2026
timetable confirms Paper I is practical. Specific NECO tasks and
marking specifications remain unverified.

Batch 079 registers NECO Health Education and adds eight written drafts
on water protection, sanitation and refuse management. The 2026
timetable confirms the objective and essay papers and Test of Practical.
Official topic objectives and detailed practical requirements remain open.

Batch 080 adds six NECO Health Education vector-control observation
drafts using original mock inspection records. The 2026 timetable
identifies Paper I as Test of Practical. The observation format uses
historical cross-board evidence, with exact NECO requirements open.

Batch 081 registers NECO Physical Education and adds eight written
relay drafts. The 2026 timetable verifies practical, essay and objective
papers. Topic alignment remains provisional. Rules questions use World
Athletics' 2026 technical rules. Official practical tasks remain open.

Batch 082 adds six supervised Physical Education relay drills with
observable criteria for performance and feedback. NECO's timetable
confirms Paper I as practical. Classroom tasks and marks are provisional.

Batch 083 registers NECO SSCE Internal Marketing and adds nine
original objective and structured drafts on the marketing mix, pricing
and distribution. The 2026 timetable verifies paper codes and formats.
The learning objectives use historical WAEC topic evidence provisionally.
