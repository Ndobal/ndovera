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

Batch 084 registers NECO Catering Craft and adds eight objective and
structured drafts on menus and table service. The 2026 Internal
timetable lists practical (4011), essay (4012) and objective (4013)
papers. The batch covers written practice using provisional topic
references from WAEC. NECO practical task and marking specifications
remain unverified.

Batch 085 adds six supervised Catering Craft table-service simulations.
Learners demonstrate service, equipment selection and fault recovery.
The 2026 NECO Internal timetable verifies the practical paper format.
The simulations and marking guides are original classroom practice,
with provisional topic alignment and official task details still open.

Batch 086 registers NECO Livestock Farming and adds eight objective
and structured drafts on poultry records and deep-litter housing.
The 2026 Internal timetable verifies papers I (5041, practical),
II (5042, essay) and III (5043, objective). The written topics use
historical WAEC Animal Husbandry reports provisionally. Official
NECO content objectives and practical task details remain open.

Batch 087 adds six supervised Livestock Farming simulations on
poultry records, traceability, equipment checks and litter management.
The 2026 Internal timetable confirms Paper I as practical. The
model tasks and classroom marking guides are provisional.

Batch 088 registers NECO Computer Hardware and GSM Repairs and adds
eight written drafts on component roles and fault isolation. The 2026
Internal timetable verifies practical (5011), essay (5012) and
objective (5013) formats. Historical WAEC examiner reports inform
provisional topic mapping. Official NECO objectives and practical
tasks remain unverified.

Batch 089 adds six supervised Computer Hardware and GSM Repairs
classroom practical drafts. The 2026 NECO timetable verifies Paper I
as practical. Topic evidence is historical and cross-board. The tasks
and marking guides are original and provisional.

Batch 090 opens NECO Fashion Design and Garment Making with eight
written drafts on open seams, edge finishing and sleeve alterations.
The 2026 Internal timetable verifies papers 5021, 5022 and 5023.
Historical WAEC reports inform provisional topic mapping. Detailed
NECO practical requirements and official objectives remain open.

Batch 091 adds six supervised Fashion Design and Garment Making
classroom practical drafts. The 2026 NECO timetable verifies Paper I
as practical. Topic evidence is historical and cross-board. The tasks
and marking guides are original and provisional.

Batch 092 opens NECO Beauty and Cosmetology with eight written drafts
on salon hygiene and hair care. The 2026 Internal timetable verifies
practical (5001), essay (5002) and objective (5003) papers. Historical
WAEC examiner evidence informs the provisional topic mapping. Official
NECO subject objectives and practical marking remain unverified.

Batch 093 adds six supervised Beauty and Cosmetology
classroom practical drafts. The 2026 NECO timetable verifies Paper I
as practical. Topic evidence is historical and cross-board. The tasks
and marking guides are original and provisional.

The Livestock Farming register also records Paper IV (5044) as
progressive assessments. Assessment tasks and marks remain open.

Batch 094 adds eight NECO Home Management written drafts on
time planning and household budgeting. NECO paper formats are
verified and topic mapping is provisional.

Batch 095 adds six supervised Home Management
classroom practical drafts. The 2026 NECO timetable verifies Paper I
as practical. Topic evidence is historical and cross-board. The tasks
and marking guides are original and provisional.

Batch 096 adds eight NECO Music written theory drafts on metre,
rhythm, relative keys and cadences. Topic alignment is provisional.
Performance, music technology and aural assessment remain open.

Batch 097 adds four provisional NECO Music aural tasks with original examiner-only playback scripts. The official Paper IV delivery and marks and Paper I specifications remain unresolved.

Batch 098 adds six NECO French written drafts with original French
passages and production prompts. Official marking and oral delivery
requirements remain unverified, as do Music Paper I instructions.

Batch 099 adds four supervised NECO French oral interaction tasks
with separate examiner scripts and provisional marking guides.
Official NECO oral delivery and marking remain unverified.

Batch 100 adds four original NECO Arabic composition drafts.
Official oral tasks, prescribed texts and marking remain unverified.

Batch 101 adds four NECO Arabic oral interaction drafts. The
classroom scripts and rubrics are provisional. NECO oral delivery,
marking and prescribed literature remain unverified.

Batch 102 adds four original NECO Hausa composition drafts on
letter writing and reasoned argument. Official prescribed texts and
marking remain unverified.

Batch 103 adds four original NECO Igbo composition drafts on formal
correspondence, dialogue, argument and advice. The 2026 timetable
confirms paper formats and a literature component. Historical WAEC
examiner observations inform provisional genre mapping. NECO's official
content objectives, prescribed texts and marking remain unverified.

Batch 104 adds four original NECO Yoruba composition drafts on
narrative, description, exposition and argument. The 2026 timetable
verifies paper formats. Historical WAEC examiner observations support
provisional genre mapping. NECO prescribed texts and marking remain open.

The WAEC 2026–2030 selected-text register now links seven official
language PDFs and records their checksums. The Yoruba source also
records the five year-specific written poetry page ranges. Edo, Efik
and Ibibio have provisional target rows backed by their WAEC lists.
Full objectives, work editions, paper requirements and NECO adoption
still require separate evidence.

The Yoruba selected-text source now indexes the three written and three
oral literature works, plus the annual oral poetry selections. The list
includes commentary on each year's oral poetry selections. Historical
Paper 2 examiner guidance and a catalogue cross-check are recorded
separately. The primary texts, edition equivalence and current Paper 2
scheme remain open.

Batch 105 adds four WAEC Yoruba language drafts on lexical tone and
formal correspondence. Historical Paper 2 examiner observations inform
the provisional mappings. Current Paper 2 rules and primary editions
of prescribed works remain unverified.

Batch 106 adds four WAEC Igbo grammar drafts on word classes and word
formation. Historical Paper 2 examiner material supports provisional
topic mappings. Current paper rules and prescribed editions remain open.

Batch 107 adds four WAEC Hausa grammar drafts on clause linkage and
adverbial reduplication. Historical private-candidate Paper 2 reports
support provisional mapping. Current paper rules and editions remain open.

Batch 108 adds four WAEC Arabic writing drafts on adjective agreement,
tense consistency, pronoun clarity and informal correspondence.
Historical Paper 2 evidence supports provisional mapping. Editing tasks
use original classroom formats. Current paper rules and editions remain open.

Batch 109 adds four WAEC Edo drafts on vowel and consonant spelling,
written numerals and paired verb forms. Original classroom tasks use
English instructions and Edo response targets. Historical Paper 2
observations support provisional mappings. Current paper rules,
marking and primary editions remain open.

Batch 110 adds four WAEC Efik drafts on articulation, low-tone spelling,
adjectives and imperatives. Historical Paper 2 observations support the
provisional mappings. Current paper rules and editions remain open.

Batch 111 adds three WAEC Ibibio drafts on consonant articulation,
tone patterns and lexical borrowing. Historical Paper 2 observations
support provisional mappings. Current paper rules and editions remain open.

Batch 112 uses the downloaded Cambridge Physics 0625 version 2
syllabus for 2026–2028. Eight original Core and Extended drafts
cover selected Space physics objectives in multiple-choice and
theory formats. Full objective coverage remains open.

Batch 113 adds ten Cambridge IGCSE Physics 0625 waves and electricity
drafts mapped to selected 2026–2028 version 2 objectives. It includes
Core and Extended multiple-choice and theory practice. Full syllabus
coverage and independent review remain open.

Batch 114 adds eight Cambridge IGCSE Physics 0625 thermal and nuclear
physics drafts. Core and Extended items use the verified 2026–2028
version 2 syllabus. Full coverage and independent review remain open.

Batch 115 opens Cambridge IGCSE Economics 0455 with seven original
2026 resource allocation drafts. The untiered questions cover both
papers. Structured items are standalone practice. The distinct
2027–2029 syllabus requires separate mapping.

Batch 116 adds six original Economics 0455 drafts using the separate
2027–2029 version 1 syllabus. The bank retains distinct source mappings
for the 2026 and 2027–2029 paper schemes.

Batch 117 adds twelve Primary 6 NCEE National Values Education drafts
on honesty, justice, contentment and community service. NECO confirms
Paper I Part B. Historical ICPC teaching guidance supports provisional
topic mapping. The official topic specification and option count remain open.

Batch 118 adds eight NCEE Quantitative and Vocational Aptitude drafts
on cleaning, meal planning and kitchen safety. Historical Primary Six
Pre-Vocational Studies guides provisional mapping. The current NECO
topic blueprint and option count remain unverified.

Batch 119 adds six original NECO BECE Basic Science and Technology
drafts on sound and electrical energy. NECO verifies objective formats.
Historical NERDC JSS 3 content provides provisional topic evidence.
Current adoption, paper-level objectives, practical and drawing rules
and official option counts remain open.

Batch 120 adds three supervised spreadsheet tasks and two orthographic
drawing tasks for JSS 3 BECE Basic Science and Technology. The 2026 NECO
timetable confirms both formats. Historical NERDC objectives support
provisional classroom practice. Official task instructions, marking,
and current curriculum adoption remain open.

The 2026 NECO BECE and SSCE Internal registration guidelines identify
separately available syllabuses. The source register records both access
notices and the missing copies. For BECE Basic Science and Technology,
the official topic allocation, practical instructions, equipment and
marking rules still require primary documents. The existing classroom
drafts retain their provisional mappings.

Batch 121 opens IELTS Academic Listening with a ten-item Part 1 form
completion set. For supervised use, show only the learner instructions
and question prompts. Two readers perform the separate examiner dialogue
once. Recorded audio and the other Listening parts remain open.

Batch 122 adds a ten-item IELTS Academic Listening Part 2 set on a
community garden. It uses five matching items and five sentence
completions with an original monologue for supervised live delivery.
Recorded audio, Parts 3–4 and wider task coverage remain outstanding.

Batch 123 adds ten IELTS Academic Listening Part 3 note-completion
items using an original discussion between two students planning a
campus sound study. It requires two readers for supervised live
delivery. Recorded audio and Part 4 remain outstanding.

Batch 124 adds ten IELTS Academic Listening Part 4 note-completion
items with an original lecture on oral history research. The lecture
uses an explicitly hypothetical teaching example. All four Listening
parts now have an initial set for supervised live delivery. Recorded
audio, delivery validation and broader skill coverage remain open.

Batch 125 opens TOEFL Listening with twelve original single-exchange
response-selection drafts mapped to the 2026 task family. Scripts
support supervised live delivery. The official Updated Test Overview illustrates
four written response choices. Recorded audio,
other Listening task families and adaptive delivery remain open.

Batch 126 adds twelve TOEFL Listening drafts across six original
two-speaker conversations, with two questions per conversation.
They cover intent, detail, inference and likely next actions.
Supervised live delivery is required. Recorded audio, announcements,
academic talks and adaptive delivery remain outstanding.

Batch 127 adds twelve TOEFL Listening drafts across six original
campus announcements of 40–85 words. Two questions per announcement
are an author choice; the retrieved overview does not specify a fixed
count. Supervised live delivery is required. Recorded audio,
academic talks and adaptive delivery remain outstanding.

Batch 128 adds twelve TOEFL Listening drafts across three original
academic talks on opportunity cost, map simplification and controlled
comparisons. Each 100–250-word talk has four questions. Initial live
practice now spans all four Listening task families. Recorded audio,
delivery validation and broader coverage remain outstanding.

Batch 129 opens NECO BECE Business Studies with eight original JSS 3
objective drafts on business analysis and trial balances. Historical
NERDC objectives inform provisional mapping. The 2026 timetable
verifies paper formats. Current adoption, NECO topic allocation,
option counts and practical requirements remain outstanding.

Batch 130 adds four supervised BECE Business Studies classroom tasks
on letter layout, correction, tabulation and printing. Historical
NERDC JSS 3 objectives support provisional alignment. The tasks and
marking guides are original. Official NECO practical requirements
and current curriculum adoption remain outstanding.

Batch 131 opens NECO BECE English Studies with eight original
reading-for-summary drafts using two original passages. Historical
JSS 3 objectives inform provisional mapping. Current NECO paper-level
content, option counts, essay requirements and curriculum adoption
remain outstanding.

Batch 132 adds four BECE English Studies composition drafts covering
narrative, descriptive, expository and argumentative writing. Each
includes an illustrative model response and an original classroom
rubric. Historical topic alignment remains provisional. Official
Paper III choices, word limits and marking remain outstanding.

Pre-Vocational Studies source retrieval was rechecked on 7 November
2026. NECO confirms objective papers 8311/8312. NERDC's historical
index names the subject, but no usable content document was retrieved.
The revised JSS 3 link returned 404. The bank remains empty and its
content objectives, option count and current adoption remain open.

Batch 133 opens NECO BECE History with six original JSS 3 conceptual
drafts on colonial rule, amalgamation and nationalism. Historical
NERDC topic mapping is provisional. Name errors and a problematic
Berlin treaty claim in that source are recorded for verification.
Current adoption, NECO topic allocation and option counts remain open.

Batch 134 adds six BECE History drafts with authoritative checks on
amalgamation, independence, republican status, Lugard and the Berlin
Conference. The source register corrects the Lugard spelling and
qualifies the curriculum's Berlin treaty claim. Current syllabus
adoption, paper-level scope and independent review remain open.

Batch 135 opens NECO BECE Cultural and Creative Arts with eight
original JSS 3 objective drafts on lettering, display, uses of music
and community drama. Historical topic mapping remains provisional.
Current adoption, NECO topic allocation, option counts and practical
task requirements remain outstanding.

Batch 136 adds four BECE Cultural and Creative Arts classroom
practical drafts on lettering, mounting, display arrangement and
community drama. Each includes a model outcome and practice marking
guide. Historical topic mapping is provisional. Official practical
tasks, materials, marking and current adoption remain outstanding.

Batch 137 opens NECO BECE National Values Education with twelve
original JSS 3 objective drafts on work attitudes, family support,
peaceful living and conflict resolution. The retrieved NERDC source is
explicitly dated July 2018. Mappings and four-option practice remain
provisional; current adoption, full scope and NECO paper allocation
remain unverified. No religious-route mapping is inferred.

Batch 138 opens NECO BECE French Language with twelve original
written-comprehension drafts across four original texts on professions,
routines, a past visit and an informal invitation. Historical JSS Three
topic mapping is provisional. These receptive drills do not assess
speaking, listening or written production. Current adoption, official
2051/2052 content allocation and option counts remain unverified.

Batch 139 opens NECO BECE Christian Religious Studies with twelve
original JSS 3 drafts on Paul before the council, Felix, Festus and
King Agrippa. Acts 23–25 were checked directly. The source register
flags malformed historical references and the description of Agrippa
as a governor. Current adoption and paper-level scope remain open.

The official September 2025 revised CRS JSS 1 PDF was also retrieved
from its direct LMIS URL and registered separately. Exact outcome
mapping, cohort adoption and bank reconciliation are pending. This
access advance does not resolve JSS 3 or other class-subject gaps.

The CRS JSS 1 source-mapping run registers national rollout evidence,
a separate exact-class bank, a sixteen-topic contents inventory and ten
initial performance-objective mappings for the first three topics.
No questions were added. The 1,000-item target remains provisional.
School adoption, other outcomes, performance assessment and capacity
remain open. No terms, ages or legacy class assignments were inferred.

The next CRS JSS 1 mapping pass adds 24 objective mappings across
topics 4–9, reaching 34 initial mappings in nine topics. Direct PDF
inspection corrects later page locators after a repeated obedience
table. Evaluation wording conflicts remain flagged. Seven topics and
full assessment reconciliation are still open. No questions added.

Batch 140 opens revised CRS JSS 1 with eight classroom drafts,
including actual singing, modelling, family-tree drawing and role-play.
Each has an original four-mark guide. The initial map now records
61 objective entries across sixteen topics; source overlap and wording
issues remain flagged. Full competency/evaluation reconciliation,
school adoption and independent review remain incomplete.

Batch 141 opens NECO BECE Islamic Studies with ten original JSS 3
ethics drafts. Historical topic mapping remains provisional. The
register distinguishes the justice injunction in Q5:8 from Q5:9 and
records source rendering limitations. Current adoption, full paper
scope, option counts and recitation requirements remain open.

Batch 142 opens NECO BECE Arabic Language with eight original
written-reading drafts across two original texts. Direct retrieval and
PyMuPDF rendering verified historical 2012 ninth-year source pages.
Topic mapping remains provisional. Current adoption, full paper scope,
option counts, listening and oral-reading requirements remain open.
Batch 143 opens NECO BECE Hausa (L1) with eight original written-
comprehension drafts across environmental-awareness and computer-record
passages. The historical source explicitly targets mother-tongue learners;
JSS 3 content mapping is provisional. L2 remains unopened. Current adoption,
full objectives, paper allocation and official option counts remain open.

The Igbo source investigation retrieves the historical curriculum and
foreword and inventories nineteen JSS 3 topic tables with page locators.
Neither document establishes BECE L1/L2 assignment or current adoption.
Both routes remain unopened; no questions or active objectives are added.
See `specifications/igbo-jss3-historical-scope-inventory.json`.

Batch 144 opens NECO BECE Yoruba (L1) with eight original written-reading
drafts on road safety and equal participation. The historical foreword
addresses mother-tongue learning; JSS 3 comprehension was checked visually
because text extraction loses letters and tone marks. L2 stays unopened.
Current adoption, full scope, paper allocation, option counts and native-
language academic review remain outstanding.

Batch 145 adds 24 IGCSE Chemistry 0620 Extended drafts: sixteen structured
theory and eight written practical-evaluation tasks. The official 2026–2028
version 2 source was retrieved again and hashed. Six narrower objective
mappings extend acids, salts, water, air and analysis coverage. Original
marking guides and arithmetic checks do not confer academic approval;
full content coverage and independent review remain incomplete.

Batch 146 adds 24 IGCSE Biology 0610 Extended drafts across classification,
variation, selection, biotechnology and practical evidence. Six new
author-proposed mappings accompany sixteen structured theory and eight
written alternative-to-practical tasks. Version 3 for 2026–2028 was
retrieved again and hashed. Data are original illustrative examples;
full syllabus coverage, laboratory experience and independent academic
review are not established by these drafts.

Batch 147 adds 24 IGCSE Physics 0625 Extended drafts: sixteen structured
theory and eight written experimental tasks. The official v2 syllabus and
update notice were retrieved again. An explicit Physics bank entry now
reconciles the previously observed bank with this source, retaining its
existing target. Full coverage and academic review remain pending.
The practical-format gate now includes Physics 0625 alongside Biology 0610
and Chemistry 0620, with regression tests for valid written AO3 practice
and invalid MCQ, component or mixed-assessment labels.

Batch 148 adds 24 IGCSE Economics 0455 structured drafts, split equally
between 2026 v2 and 2027–2029 v1. Direct cloud PDF retrieval succeeded
after web-reader errors, and both versions were rechecked and hashed.
The new mappings cover households, workers, firms, living standards,
poverty and population. Original analytical/evaluation guides remain
academic-review pending; Economics AO3 is evaluation, not a practical
assessment. No full-cycle coverage is claimed.

Batch 149 adds 32 SAT Reading and Writing drafts, eight per domain,
with eleven finer author-proposed skill mappings. Each item has its own
original stimulus, including paired texts, tables and research notes.
Official skill/format pages were rechecked. Equal practice allocation
does not reproduce the official domain weighting or an adaptive module.
Independent review, difficulty calibration and full coverage remain open.

Batch 150 adds 24 original revised CRS JSS 1 drafts across previously
unrepresented outcomes, including friendship and worship performances.
Batch 151 adds thirteen early-life narrative and classroom-production
drafts across ten more initial outcomes, including a performed drama
and a produced poster. Scripture checks distinguish the gospel accounts
and flag a malformed family-teaching reference. Unsupported health claims
remain excluded. The 45 drafts represent 42 initial objective entries;
full competency reconciliation, school adoption and academic review
remain open.

Batch 152 adds thirteen revised CRS JSS 1 written drafts on biblical
freedom, service, repentance and related underrepresented outcomes.
Primary passages were checked; the John-the-Baptist Matthew reference
mismatch is recorded and the valid Luke passage used. Fifty-eight drafts
represent 55 of 61 initial objective entries, not full coverage. Six
entries, source conflicts, school adoption and academic review stay open.

Batch 153 adds 24 NCEE Verbal Aptitude contextual word-relationship
drafts and 24 English Studies reading drafts using six original stimuli.
Official 2026 components were rechecked. Historical Primary 6 English
locators support provisional skill alignment, not proof of current adoption
or a complete NCEE topic blueprint. Four-option practice and one-mark
scoring are author choices; production skills and academic review remain open.

Batch 154 adds 28 NCEE BST conceptual drafts across seven finer
provisional Primary 6 mappings. The historical source was retrieved and
hashed, with exact page locators. Source astronomy/climate/colour wording
issues are recorded; current adoption and full NCEE topic allocation
remain unverified. These MCQs do not assess practical performance, and
four-option one-mark scoring remains an author practice choice.

Batch 155 adds 24 NCEE Quantitative and Vocational Aptitude drafts
on clothing construction, packaging, farm records, cleaning and meal
constraints. Historical Primary 6 pp19–23 were rechecked and hashed.
Two sewing-related mappings are provisional; MCQs assess decisions, not
practical performance. Full current NCEE scope and adoption remain open.

Batch 156 adds eight WAEC map-evidence and eight NECO human-geography
structured drafts, including an actual scale-plan drawing. Official NECO
2026 Internal codes/formats were rechecked. Accessible historical WAEC
reports support limited topics; newer index targets returned 404. Source
heading/URL date ambiguities stay recorded. All original four-mark guides
are provisional practice; full current specifications remain unavailable.

Batch 157 adds six TOEFL iBT email and six academic-discussion
production drafts. The ETS overview was freshly retrieved and hashed;
seven-/ten-minute task timings and discussion guidance were checked.
Original models and analytic ten-point practice guides do not represent
official scoring. No email minimum length is inferred. Manual language
review, broader task coverage and full-section assembly remain open.

Batch 158 adds 24 original TOEFL Build a Sentence drafts and reconciles
the five earlier drills to explicit exchanges, frames and chunk banks.
The freshly retrieved ETS overview p13 shows an unused-word example;
this is not made a universal rule. Assembly checks verify accounting and
reconstruction, not linguistic uniqueness or official scoring. Full
delivery validation and independent academic review remain open.

Batch 159 adds four IELTS Speaking Part2 long turns and eight linked
Part3 discussion questions, using shared Academic/General Training format.
Official timing and criteria were rechecked. Actual live/recorded speech
is required; original model transcripts cannot establish pronunciation or
speaking duration. Eight-point guides have no official band equivalence.
Part3 timing applies to the whole discussion, not each question.

Batch 160 adds six IELTS General Training Task1 letter-production drafts
on enquiry, complaint, invitation, changed arrangements, advice and
service improvement. Current official letter format was rechecked. Each
model has at least150 words and covers three specified content points.
Original eight-point analytic guides require manual assessment and do
not convert to IELTS bands. Broader coverage and academic review stay open.

Batch 161 opens NECO BECE Pre-Vocational Studies with24 original JSS3
conceptual objective drafts across eight provisional mappings. Direct
retrieval now succeeds for the historical NERDC curriculum and foreword;
selected exact-class tables were visually checked and hashed. A twelve-topic
inventory records exclusions and remaining gaps. The revised JSS3 page still
returns404. Current adoption, full NECO scope,8311/8312 topic allocation
and official option count remain unverified. MCQs do not assess practical
weaving, laundering or sewing. Igbo L1/L2 assignment remains unresolved.

Batch 162 adds three IELTS Academic Writing Task 1 process tasks. Each
question references an original SVG relative to question-data and supplies
a text equivalent of every labelled connection. Present the prompt with
the stimulus and reserve the model and eight-mark guide for assessment.
The diagrams and models were checked together. Delivery integration and
independent academic review remain pending.

Batch 163 adds three IELTS Academic Task 1 chart comparisons covering
trends, matched categories and percentage composition. The original charts
use fictional data and include text equivalents and structured values.
Models and eight-mark practice guides accompany each task. The rendered
charts, labels and comparisons were checked. Independent review and
delivery integration remain pending.

Batch 164 adds 24 NCEE English Studies drafts covering drama reading,
dictionary use, idioms, contextual word meanings, figurative comparisons
and text organisation. NECO’s 2026 notice and timetable confirm Paper I
Part B. Historical NERDC Primary 6 pages 36, 40–43 and 45–46 support the
provisional topic mappings. Four options and one mark are practice choices.
Current adoption, the official item blueprint and academic review remain open.

The NECO 2027 SSCE Internal timetable recheck records 97 paper codes
across 36 matched banks. General Mathematics retains 1023 objective and
1022 essay. Livestock Farming uses 5031–5034 in 2027 and 5041–5044 in 2026.
The registry keeps year-specific evidence and preserves historical mappings.
Section 7 of the 2027 registration guide identifies a separate syllabus.
The topic blueprint still needs that source. Batch 165 remains next.

Batch 165 opens NECO Technical Drawing and Visual Arts with four
production tasks each. Drawings and designs require manual assessment.
Original briefs and marking guides cover projection, sectional drawing,
observational drawing and graphic design. The 2027 NECO timetable supports
paper formats and historical WAEC examiner material supports provisional
topic links. Current NECO topic requirements and independent review remain open.

Batch 166 adds 12 objective drafts each for NECO Technical Drawing and
Visual Arts. The 2027 timetable lists objective papers 2103 and 4123.
Historical WAEC material supports provisional topic mappings for projection,
sections, observational drawing and graphic design. The four-choice format
and one-mark score are practice choices. Current NECO topic allocation and
independent review remain open.

Batch 167 adds 20 original Cambridge IGCSE Economics 0455 Paper 1
items for 2027–2029. The new objectives cover exchange-rate quotations,
currency markets, traded prices and the current account. Three numerical
answers have arithmetic checks and the currency figures are fictional.
Paper 2 evaluation practice and independent academic review remain open.

Batch 168 adds 12 standalone Cambridge IGCSE Economics 0455 Paper 2
drafts for 2027–2029. Original scenarios test currency-market responses,
current-account interpretation and policy trade-offs. Each task has a
worked answer and a six-mark practice guide. Five calculation checks
passed. Full-paper assembly and independent academic review remain open.

Batch 169 opens the NERDC JSS 1 Social and Citizenship Studies bank with
12 objective, four written and two supervised performance drafts. The
September 2025 official PDF was retrieved and hashed. Six outcomes from
printed pages 3, 8 and 17 support the initial mapping. The national
rollout evidence is recorded separately from school adoption. Full
curriculum coverage and independent review remain open.

Batch 170 adds 18 NERDC JSS 1 Social and Citizenship Studies drafts on
culture, socialisation and conflict prevention and resolution. The exact
September 2025 PDF matched its registered checksum. The 12 objective
questions and six written or artefact tasks map to six additional outcomes
from printed pages 7, 11 and 12. School adoption and academic review remain open.

Batch 171 adds 19 NERDC JSS 1 Social and Citizenship Studies drafts on
climate change, disaster risk, early warnings and community safety. The
13 multiple-choice questions and six written or artefact tasks map to
13 additional objectives from printed pages 14–16 and 19 of the September
2025 curriculum. The bank now has 55 valid drafts across 25 mapped objectives.
School adoption, remaining curriculum scope and academic review remain open.

Batch 172 adds 14 NERDC JSS 1 Social and Citizenship Studies drafts mapped
to six objectives on outbreak communication and continuity of services
after disasters. The set includes six multiple-choice items, four written
tasks, two spoken role-plays and two visual communication tasks. The bank
now has 69 valid drafts across 31 mapped objectives. Direct-care coverage,
school adoption and independent academic review remain open.

Batch 173 adds 19 NERDC JSS 1 Social and Citizenship Studies drafts mapped
to nine financial literacy objectives. It includes 15 multiple-choice
questions, three written tasks and one supervised cash-handling simulation.
The bank now has 88 valid drafts across 40 mapped objectives. School adoption,
remaining curriculum objectives and academic review remain open.

Batch 174 adds 15 NERDC JSS 1 Social and Citizenship Studies drafts across
ten objectives on family as a primary social group and civic responsibilities.
Nine are multiple-choice questions and six are written or artefact tasks. The
bank has 103 valid drafts across 50 mapped objectives. Civic examples focus on
freedom of expression and care for public property. School adoption, full
curriculum coverage and independent academic review remain open.

Batch 175 adds 14 NERDC JSS 1 Social and Citizenship Studies drafts across
seven social conflict and peace education objectives. Eight are multiple-choice
questions and six are written tasks. The bank has 117 valid drafts across
57 mapped objectives. School adoption, remaining curriculum objectives and
independent academic review remain open.

Batch 176 registers the September 2025 NERDC JSS 1 English Studies curriculum
and adds 14 original reading drafts across eight mappings from printed pages
5–7. Nine are multiple-choice and five are written. One earlier legacy entry
remains held. School adoption, assessment formats, full curriculum coverage
and independent academic review remain open.

Batch 177 adds 12 NERDC JSS 1 English Studies drafts mapped to nine writing
objectives. Seven are written responses and five assess supporting concepts.
The bank has 26 valid drafts across 17 mapped objectives. Practice rubrics
are author-created. School adoption, formal assessment formats and independent
academic review remain open.

Batch 178 adds 16 NERDC JSS 1 English Studies drafts across nine objectives
in grammatical accuracy and oral performance. Nine are multiple-choice,
three are written and four require oral answers. Two oral tasks supply
original examiner-read scripts. The bank has 42 valid drafts across 26
mapped objectives. School adoption, delivery integration and independent
academic review remain open.

Batch 179 adds 13 NERDC JSS 1 English Studies drafts across ten literature
objectives. The batch includes eight multiple-choice questions, four written
tasks and one oral retelling using original excerpts. The bank has 55 valid
drafts across 36 mapped objectives. Full curriculum coverage, school adoption
and independent academic review remain open.

Batch 180 registers the September 2025 NERDC JSS 1 Nigerian History curriculum
and adds 14 drafts across nine objectives on historical inquiry, source
classification and using evidence. Eight are multiple-choice and six are
written. School-level adoption, formal assessment formats and full coverage
remain unverified. Independent academic review is pending.

Batch 181 adds 12 NERDC JSS 1 Nigerian History drafts across eight objectives
on Nok, Ile-Ife, Benin and Igbo-Ukwu. Museum and archaeological references
support selected content. Three earlier source locators now follow the printed
body pages. The bank has 26 valid drafts across 17 mapped objectives. School
adoption and independent review remain open.

Batch 182 adds four NERDC JSS 1 Nigerian History map tasks on Nok, Ile-Ife,
Benin City and Igbo-Ukwu. The original coordinate locator uses present-day
reference points from the Getty Thesaurus of Geographic Names. It includes
a text alternative and marks no historical boundaries. The bank has 30
valid drafts across 21 mapped objectives. Academic review remains pending.

Batch 183 adds 10 NERDC JSS 1 Nigerian History drafts across four objectives
on precolonial centralised states. Five are multiple-choice and five are
written. The bank has 40 valid drafts across 25 mapped objectives. Location
coverage, school adoption and independent academic review remain open.

Batch 184 adds six NERDC JSS 1 Nigerian History drafts on Old Oyo, Kano and
Benin City. Five use the original coordinate locator, which includes a text
alternative. The bank has 46 valid drafts across 28 mapped objectives. Other
polities, full chronology, school adoption and academic review remain open.

Batch 185 registers the September 2025 NERDC JSS 1 Cultural and Creative
Arts curriculum and adds ten original drafts across eight visual arts
objectives. Five are multiple-choice and five are practical tasks with
marking guides. School adoption, assessment formats, remaining objectives
and independent academic review remain open.

Batch 186 adds ten NERDC JSS 1 Cultural and Creative Arts drafts across
eight drama and music objectives. It includes three multiple-choice items,
five supervised performances and two stave tasks. The bank has 20 valid
drafts across 16 mapped objectives. School adoption, formal assessment
formats and independent academic review remain open.

Batch 187 adds eight NERDC JSS 1 Cultural and Creative Arts drafts covering
dance and introductory choreography, including four supervised performance
tasks with original marking guides. The exact-class September 2025 curriculum
supports the mappings. School-level adoption and formal assessment formats
remain open. Independent academic review is pending.

Batch 188 adds twelve NERDC JSS 1 Cultural and Creative Arts drafts on
craft, weaving, collage and mosaic. Three tasks require supervised artefact
production using classroom materials and original marking guides. School-level
adoption, formal assessment formats and independent academic review remain open.

Batch 189 adds eight NERDC JSS 1 Cultural and Creative Arts drafts on
beading and wood carving, including supervised production of a beaded
display strip. Wood-carving tasks use written reasoning and teacher
demonstration contexts. Learner wood carving, school adoption, formal
assessment formats and independent academic review remain open.
