Ndovera – Additional Feature Updates
1. Attendance: Daily Staff Punctuality Log — ✅ DONE AND COMPLETED (5 Oct 2026)
Add a Daily Staff Attendance/Punctuality Log.
The system should record staff attendance and punctuality for each working day, including arrival/clock-in status where applicable.
Management should be able to view daily, weekly, monthly and term-based attendance/punctuality reports.
Monthly punctuality recognition
Introduce a Monthly Punctuality Winner.
Ndovera should calculate punctuality based on the school's configured working/arrival times and identify the most punctual staff member(s) for the month.
The winner should appear prominently on the staff dashboard when users first open the application for the relevant period.
This should be a school-level award, not a general Ndovera-wide award.
The school should also be able to attach a celebratory badge/recognition award to the winner.
2. Owner/HOS School Calendar Management — ✅ DONE AND COMPLETED (5 Oct 2026)
The Owner and HOS should be able to:
- Create school calendar events.
- Edit events.
- Set event dates and times.
- Set reminders where applicable.
- Publish events to staff, parents, students or selected groups.
- Remove/cancel events with an audit trail.
The school calendar should integrate naturally with relevant dashboards so upcoming school activities are visible to the intended users.
3. Timetable Management — ✅ DONE AND COMPLETED (5 Oct 2026)
The Owner/HOS should be able to set and edit school timetables.
This should include class timetables and other timetable types already supported by Ndovera.
Changes should be properly controlled and recorded so that the currently published timetable remains clear to teachers and students.
4. Staff Evaluation / Peer Review System — ✅ DONE AND COMPLETED (5 Oct 2026)
Add a Staff Evaluation module.
Staff should receive a structured questionnaire allowing them to review/evaluate their colleagues.
The school should configure:
- Evaluation period
- Questions
- Rating scale
- Eligible reviewers
- Staff being evaluated
- Opening date
- Closing date
Ndovera should aggregate the submitted reviews and use them to produce a general staff evaluation for each staff member.
AI can assist in summarising the feedback, identifying recurring strengths or concerns and producing a management-friendly overview.
However, AI should not invent ratings or comments that were not present in the submitted evaluations.
Evaluation deadline
Every evaluation exercise should have a defined period.
Once the deadline expires, the evaluation should automatically close unless an authorized administrator extends it.
The system should clearly show:
Not Started → Open → Completed/Closed
Management should be able to see completion rates without unnecessarily exposing individual reviewers.
5. Teacher Work Submission — ✅ DONE AND COMPLETED (5 Oct 2026)
Create a proper Submit Work section for teachers.
Teachers should be able to submit different types of academic work for review.
Do not limit the system to a few hard-coded submission types.
Instead, provide:
Submission Type
Examples could include:
Lesson Plan
Lesson Note
Exam Questions
Test Questions
Scheme/Plan
Other
If Other is selected, the teacher should specify what is being submitted.
The teacher then selects:
Class → Subject → Submission Type → Period/Week → Files/Content → Submit
6. Lesson Plans Added to Submission System — ✅ DONE AND COMPLETED (5 Oct 2026)
Lesson Plan should specifically be included among the available submission types.
Teachers should be able to submit lesson plans according to the school's required schedule.
7. Weekly/Bulk Teacher Submission — ✅ DONE AND COMPLETED (5 Oct 2026)
Teachers are expected to submit work regularly, including weekly submissions where configured by the school.
Ndovera should support bulk submission.
For example, a teacher should be able to submit:
Week 1 – Week 4
together where permitted, instead of having to perform four completely separate submission processes.
However, each week/work item should remain separately identifiable for review and approval.
8. Teacher Submission History — ✅ DONE AND COMPLETED (5 Oct 2026)
Every teacher should have a dedicated:
My Submissions
page containing all work they have submitted.
It should show information such as:
Submission Type
Class
Subject
Week/Period
Date Submitted
Status
Reviewer
Feedback
Possible statuses:
Draft
Submitted
Under Review
Approved
Returned for Correction
Resubmitted
Teachers should be able to open previous submissions and see their complete review history.
9. Edit/Delete/Resubmit With Audit Trail — ✅ DONE AND COMPLETED (5 Oct 2026)
Teachers should be able to edit, delete or resubmit their submitted work, subject to the workflow rules established by the school.
These actions must have an audit trail.
For example:
Teacher edited Lesson Plan submission #1234 on 5 October 2026.

If work has already been reviewed, the original reviewed version should not simply disappear when the teacher resubmits it.
Ndovera should retain the version history:
Version 1 → Submitted → Returned
Version 2 → Resubmitted → Approved
This gives both teachers and management a reliable history.
10. Owner/HOS Submitted Work Dashboard — ✅ DONE AND COMPLETED (5 Oct 2026)
The Owner and HOS should have a dedicated page for reviewing teacher submissions.
They should be able to see all submitted work they are authorized to supervise.
They should be able to filter by:
Teacher · Class · Subject · Submission Type · Week · Status · Date
They should also be able to identify:
- Teachers who submitted.
- Teachers who have not submitted.
- Late submissions.
- Work awaiting review.
- Returned work awaiting resubmission.
- Approved work.
The handwritten requirement that they "must choose class" is important: Owner/HOS should be able to select a class and see submissions associated with that class, rather than receiving one huge unstructured list.
11. Submission Approval and Marking — ✅ DONE AND COMPLETED (5 Oct 2026)
Owner/HOS or another authorized reviewer should be able to:
Open → Review → Comment → Approve
or:
Open → Review → Return for Correction
There should also be a clear approval/marking mechanism.
Schools should be able to decide whether this means:
Approved / Not Approved
or a configurable score/rating where required.
The review should record who reviewed the work and when.
12. AI-Assisted Submission Review — ✅ DONE AND COMPLETED (5 Oct 2026)
AI should assist Owner/HOS in reviewing teacher submissions.
For example, for a lesson plan, AI can examine organization, completeness, learning objectives, activities, assessment and other criteria configured by the school.
However, AI should assist rather than silently make the final management decision.
A useful workflow would be:
Teacher submits → AI preliminary review → Owner/HOS reviews → Approve/Return
The reviewer should see AI suggestions but retain final authority.
13. Submission Organization — ✅ DONE AND COMPLETED (5 Oct 2026)
Submissions should be highly organized.
The handwritten note specifically requires submissions to be organized by classes.
I recommend the hierarchy:
Academic Session → Term → Class → Subject → Teacher → Submission Type → Week/Period
For example:
2026/2027
→ First Term
→ Primary 5
→ Mathematics
→ Mrs. A
→ Lesson Plans
→ Week 4
This will make the system much easier to supervise as the school accumulates thousands of submissions.
14. Current Materials Available During Submission — ✅ DONE AND COMPLETED (5 Oct 2026)
When a teacher is submitting work, the teacher should be able to access relevant current materials without leaving the submission workflow.
For example, while submitting a lesson plan, the teacher may need access to the current curriculum, scheme of work, previous approved lesson plan or relevant class/subject resources.
Ndovera should surface those resources where appropriate.
Overall workflow
The resulting workflow should become:
Teacher
Prepare Work → Select Submission Type → Select Class/Subject → Upload/Create → Submit → Track Review → Correct if Necessary → Resubmit → Approved
Owner/HOS
Select Class → View Submissions → Identify Missing/Late Work → Open Submission → AI Assistance → Review → Comment → Approve/Return → Audit
This should connect with the Owner/HOS class-supervision system we already defined, so management can move from supervising a class directly into that class's teacher submissions, materials, attendance and other academic activities without jumping between disconnected parts of Ndovera.
15. Teacher-Managed Subject Topics — ✅ DONE AND COMPLETED (5 Oct 2026)
Every teacher should be able to manage the topics for subjects assigned to them directly from the Subject tab inside the Classroom.
For example:
JSS 1A → Mathematics → Topics
The teacher can:
Add Topic · Edit Topic · Reorder Topics · Remove Topic
A topic may contain a title, description, term, week/sequence and optional learning objectives.
Teachers must only manage topics for subjects/classes to which they currently have teaching permission. All topic creation, editing and removal should have an audit trail.
Student visibility
Published topics should automatically appear in the student's corresponding subject.
For example:
Mathematics
- Whole Numbers
- Fractions
- Algebraic Expressions
- Geometry
- Statistics
This effectively turns each subject into an organized learning area rather than presenting students with an unstructured stream of uploaded materials.
16. Topics Become Learning Hubs — ✅ DONE AND COMPLETED (5 Oct 2026)
A Topic should become the central container connecting related classroom content.
Any:
Note · Teaching Material · Document · Video · Image · Assignment · Quiz · Exercise · Announcement · Other Learning Resource
can be associated with a topic.
For example:
Topic: Fractions
could contain:
Teacher's Note
Introduction to Fractions.pdf
Fractions Chart.png
Video Explanation
Class Assignment
Practice Quiz
When either a teacher or student clicks Fractions, Ndovera should display everything associated with that topic in a well-organized Topic page.
The system should therefore use a relationship such as:
Class → Subject → Topic → Learning Content
rather than relying only on a chronological feed of materials.
17. Topic Removal Must Protect Existing Content — ✅ DONE AND COMPLETED (5 Oct 2026)
Removing a topic should not accidentally delete all the materials, assignments or student records attached to it.
If a teacher attempts to remove a topic containing content, Ndovera should warn them and provide appropriate options such as moving the content to another topic or leaving it as unassigned content.
Any actual deletion should follow the material deletion/audit rules we established earlier.
18. Study Topic with Ndovera AI — ✅ DONE AND COMPLETED (5 Oct 2026)
Every student-visible topic should have a prominent:
Study with Ndovera AI
button.
When the student opens it, the AI should already know the learning context:
School → Student's Class → Subject → Topic → Current Term
and, where permitted, the teacher-provided notes and learning materials associated with that topic.
For example, instead of the student having to type:
Teach me fractions.

the student can simply open:
Mathematics → Fractions → Study with Ndovera AI
and immediately begin learning about Fractions.
The AI experience could offer actions such as:
Explain this Topic · Teach Me Step by Step · Simplify It · Give Examples · Test My Understanding · Practice Questions · Ask a Question
The responses should remain age/class appropriate.
19. Teacher Materials Should Ground AI Study — ✅ DONE AND COMPLETED (5 Oct 2026)
This is especially important.
Where the teacher has provided materials for the topic, Ndovera AI should preferentially use the approved class materials and curriculum context to help the student study.
The AI should understand the distinction between:
Teacher-provided information and AI-generated supplementary explanation.
It should not silently alter a teacher's note and present the altered version as though the teacher wrote it.
20. Completely Redesign Ndovera AI Response Rendering — ✅ DONE AND COMPLETED (5 Oct 2026)
The current AI output formatting needs correction.
Students should never see raw Markdown formatting such as:
**Photosynthesis**
### Meaning
* item
- item
when those symbols were intended as formatting instructions.
The frontend must properly parse and render the response.
So:
**Photosynthesis**
should render as Photosynthesis, not display the asterisks.
Likewise, headings, numbered steps, bullet points, tables, equations, quotations and emphasis should render as actual UI components.
21. Make AI Answers Visually Appealing — ✅ DONE AND COMPLETED (5 Oct 2026)
Ndovera AI should feel like an interactive digital textbook/tutor, rather than a plain chatbot.
A well-structured answer could render as:
Photosynthesis
Meaning
Photosynthesis is the process through which green plants use light energy to make food.
What plants need
☀️ Sunlight
💧 Water
🌿 Chlorophyll
🌬️ Carbon dioxide
How it happens
The explanation can then be presented in clear numbered steps.
Important definitions, examples, warnings, formulas and learning points can appear in appropriately styled cards.
The interface should use the existing Ndovera design system/brand colours rather than random AI-generated colours.
22. AI Response Component System — ✅ DONE AND COMPLETED (5 Oct 2026)
Instead of treating the entire AI response as one block of text, the frontend should support properly styled components for:
H1/H2/H3 headings · Paragraphs · Bold/Italic emphasis · Bullets · Numbered lists · Tables · Definition cards · Example cards · Key-point cards · Equations · Code blocks where academically relevant · Images/diagrams where supported · Practice questions
This also needs to be mobile responsive because students may study primarily from phones.
23. Structured AI Output — ✅ DONE AND COMPLETED (5 Oct 2026)
For greater reliability, I recommend that Ndovera AI not depend entirely on the model producing perfect Markdown.
Where practical, the AI layer should return structured content blocks, for example conceptually:
heading
paragraph
definition
bullet_list
example
formula
practice_question
key_point
The frontend then controls exactly how those blocks look.
This gives Ndovera control over fonts, spacing, colours, cards, accessibility and mobile responsiveness rather than allowing the AI to determine presentation.
24. Continue the Conversation Within the Topic — ✅ DONE AND COMPLETED (5 Oct 2026)
The student's AI conversation should retain the current topic context.
For example:
Mathematics → Fractions → Study with Ndovera AI
Student:
Explain equivalent fractions.

Then:
Give me another example.

Then:
I don't understand the second example.

Ndovera AI should understand that the conversation is still about the student's current Fractions learning session.
The student should not have to repeatedly explain the subject and topic.
25. Topic Progress — ✅ DONE AND COMPLETED (5 Oct 2026)
This architecture also gives us an opportunity to make the student experience much better.
Topics can eventually show learning progress such as:
Not Started → Studying → Materials Viewed → Assignment Completed → Quiz Completed
I would avoid having AI alone declare that a child has "mastered" a topic. Actual assessment results and teacher-defined requirements should determine formal academic completion.
Revised Ndovera Classroom Structure
With these changes, the core learning structure becomes:
Academic Session → Term → Class → Subject → Topic → Notes/Materials/Assignments/Quizzes → Ndovera AI Study
This is an important improvement because Topic becomes the bridge between classroom management and AI learning.
A teacher isn't merely uploading a PDF into a class anymore. They are building an organized subject:
Mathematics → Fractions → teacher's notes + resources + assignments + quizzes + AI-supported study.
The student sees the same organized structure and can click Study with Ndovera AI directly from the topic.
That would make Ndovera's classroom considerably more coherent and give the AI a real educational context rather than functioning as a generic chatbot.

---

## ✅ ALL FEATURES ABOVE ARE DONE AND COMPLETED (5 October 2026)

Every numbered item in this file (1–25) has been built, tested and marked done. Do not rebuild or repeat them.

Where they live, for reference:
- 1 Staff punctuality log and monthly award — `backend/src/staffPunctuality.ts`; Owner/HOS sidebar → Staff Punctuality
- 2 School calendar (times, audiences, reminders, edit, cancel with audit) — `SchoolCalendarBoard.jsx`; "Coming up at school" card on dashboards
- 3 Timetable drafts, publishing, versions and clash checks — `TimetableBoard.jsx`, `/api/school/timetable/*`
- 4 Staff evaluation / peer review — `backend/src/staffEvaluations.ts`; sidebar → Staff Evaluation / Evaluate Colleagues
- 5–14 Teacher work submission and review — `backend/src/teacherSubmissions.ts`; Teacher → Submit Work, Owner/HOS → Teacher Submissions
- 15–19, 24, 25 Topics as learning hubs, Study with Ndovera AI, topic progress — `backend/src/topicHub.ts`, `features/classroom/topics/`
- 20–23 AI answer rendering and structured output — `features/ai/aiContent.js`, `features/ai/AiAnswer.jsx`

## NEW FEATURES

Add new feature requests below this line. Items above are complete. Items below are marked ✅ when done or ⏳ while pending.

### N1. Fee section updates — ✅ DONE AND COMPLETED (5 Oct 2026)
dont forget the fee section updates
Built as Fees & Billing (`backend/src/finance.ts`; Owner/HOS → Finance → Fees & Billing; Accountant → Fees & Billing; parents → Fees).

### N2. Automatic enrolment into new sessions and terms — ✅ DONE AND COMPLETED (5 Oct 2026)
No students are enrolled in 2026/2027 yet. Add the school's students, then generate fees again.(/api/school/fees/payment-claims:1  Failed to load resource: the server responded with a status of 403 ()
/api/school/fees-ledger:1  Failed to load resource: the server responded with a status of 403 ()
/api/school/fees/payment-details:1  Failed to load resource: the server responded with a status of 403 ()
/api/school/fees-receipts:1  Failed to load resource: the server responded with a status of 403 ()
/api/school/fees/assessments/generate:1  Failed to load resource: the server responded with a status of 400 ()
The FetchEvent for "https://genesis.ndovera.com/roles/hos/finance" resulted in a network error response: the promise was resolved with an error response object.) this should be automatic so that once a new session is creatd, all the students in the school are automatically enrolled. and the next term should automatically enrolled.

Fixed: automatic enrolment had been silently finding no students (it asked for a `users.className` column that production does not have). Every active student is now enrolled when a session is created or opened, and when fees are generated. The HOS finance 403s were also fixed: the fee screens now use the role being used rather than the stored main role.

### N3. Teacher classroom: subjects first, members in their own tab — ✅ DONE AND COMPLETED (5 Oct 2026)
I signed in as a teacher and went to the classroom (https://genesis.ndovera.com/roles/teacher/classroom)i saw thaat when I click on subject, the names of every member iof the class was first listed before the subjects. It should be direct to the subjects offered in the class while the list of class members should be in the members tab

Fixed: Subjects opens straight to the subjects; the class list (and adding/removing members) is in a new Members tab.

### N4. Notes formatting: tables, formulas, Markdown — ✅ DONE AND COMPLETED (5 Oct 2026)
in this https://genesis.ndovera.com/roles/teacher/materials notes, its not able to format tables, formulars properly fix it (Ndovera Teacher Materials — Notes Formatting Fix
The Notes editor must support proper rich academic formatting rather than displaying AI-generated Markdown characters such as **, ###, |---|, \frac, etc. as raw text.
Area	Required behaviour
Tables	Render real responsive tables with rows, columns, headers and borders
Formulas	Render mathematical/economic formulas properly
Fractions	Display stacked fractions such as \(\frac{300}{1200}\times100\)
Symbols	Support Σ, Δ, %, ×, ÷, ≤, ≥, °, √ and similar symbols
Superscript/Subscript	Support X², CO₂, indices, powers, etc.
Headings	H1–H4 must render as actual headings
Bold/Italic	Markdown must render instead of showing **text**
Lists	Proper numbered and bulleted lists
Blockquotes	Properly styled quotations/important definitions
Images/diagrams	Responsive and positioned correctly
Alignment	Left, centre, right and justified text
Print	Tables/formulas must remain correctly formatted when printed/exported


For example, Ndovera AI may generate this:
Percentage Change = ((New Value - Old Value) / Old Value) × 100
The student/teacher should see:
\[
\text{Percentage Change}
=
\frac{\text{New Value}-\text{Old Value}}
{\text{Old Value}}
\times100
\]
And a generated Markdown table must become an actual table:
Year	Price (₦)	Price Index
2024	2,000	100
2025	2,500	125
2026	3,000	150


Important implementation requirement
Do not solve this by telling the AI to stop generating tables or formulas. Fix the Notes rendering pipeline.
Ndovera should use a structured rich-text/Markdown renderer with mathematical notation support. The pipeline should effectively be:
Ndovera AI output → parse/sanitize → Markdown/rich-text rendering → math rendering → tables → styled Notes display
The editor should also have toolbar controls for Insert Table and Insert Formula, so teachers can manually create or edit them without knowing Markdown or LaTeX.
For tables, teachers should be able to add/delete rows and columns, merge cells where appropriate, set header rows, adjust alignment and edit every cell.
For formulas, provide an Equation Editor with common templates such as fractions, powers, roots, summation and brackets, plus an advanced LaTeX input option.
Very important: editing and saving
The formatting must survive the complete lifecycle:
AI generates note → teacher edits → save → reopen → student views → print/export
Currently, fixing only the editor display would be insufficient if formatting is lost when the note is stored or retrieved.
The database/API should therefore preserve a canonical rich representation rather than stripping table or mathematical structure during save.
Ndovera AI output contract
Also update Ndovera AI so that when it generates lesson notes it deliberately structures educational content with:
proper headings → paragraphs → tables → equations → examples → worked solutions → key points → revision questions
Tables should be used where they improve comparison or data presentation, and formulas should use consistent mathematical notation.
This same renderer should be reused in Teacher Notes, Student Topic Study, Ndovera AI responses, assignments, quizzes and the examination-paper generator. That solves the formatting problem once at platform level instead of building six different renderers.)

Fixed: one shared renderer (`frontend/src/shared/rich/`) for notes, previews, AI answers and submissions; toolbar with Table and Formula editors; the AI output contract asks for LaTeX and Markdown tables.

### N5. Owner can close the school (72-hour delay, Ndovera admin alerted) — ✅ DONE AND COMPLETED (5 Oct 2026)
Built: Owner → Close School (category, written reason, school name typed to confirm). Ndovera admins are alerted at once in their header and on Ami → School Closures, where they can acknowledge it with a note. The Owner sees a live 72-hour countdown and can revoke at any time before it ends (the HOS sees the countdown but cannot close or revoke). When the 72 hours pass, the scheduled job closes the school: its website shows "this school has closed" and nobody in the school can use Ndovera. Nothing is deleted; Ami → School Closures → Reopen restores it. Backend `schoolClosure.ts`; tests `school-closure.test.mjs`.
Email: each step (requested, revoked, closed, reopened) is also emailed through Ndovera's Zoho Mail to every Ndovera admin and to the school owner; a mail failure never blocks the closure, and each send is recorded in the school's audit trail.
Add a feature for the school owner to close the school with reasons this actions sends an alert to the NDovera admin and is delayed for 72hours if owner does not revoke his action, the school is closed.

### N6. Ndovera AI — Intelligent Assessment Generator — ✅ DONE AND COMPLETED (5 Oct 2026)
Built: Teacher → AI Assessments (also "Create with Ndovera AI" on every topic); Owner/HOS → Exam Letterhead. Backend `assessmentEngine.ts` + `aiAssessments.ts`.
Quiz / Assignment / Test / Exam from the teacher's topics and notes; standards as profiles (School, WAEC, NECO, IGCSE, SAT, Custom); Bloom plan (auto or custom) with coverage meter; higher-order prompts; constrained A–D randomisation with pattern check; computed quality audit plus optional AI review (warnings only); per-question Edit / Delete / Regenerate / Duplicate / Move / marks / Bloom / difficulty / page break; add own questions; exam blueprint approved before writing; separate marking scheme, never sent to students until released; post now or schedule (open/close, attempts, late policy, auto-marking of objective questions); print-ready paper with school letterhead (print to PDF) and Word export; exams submitted through the existing Exam Questions submission path; every save is a version (who / what / when), with "Returned for corrections" and "FINAL — Approved" picked up from the review.
Gaps closed (5 Oct 2026): the Word export is a real .docx with native, editable Word equations, tables (with merged cells), page breaks and page numbers; timed assessments have a server-enforced countdown that submits at zero; tables support merged cells; each AI step falls back to a faster model if the large one takes over 55 seconds. Fixed 6 Oct 2026: about 1 in 12 answer keys could contain an A-B-C-D run; the key is now built by a search that guarantees every rule (balanced letters, never three in a row, no A-B-C-D runs) — checked on thousands of keys. Still to do: a live check of question quality against the real model.
is it posible for the teacher to create quizes or assignments automatically using Ndovera AI? If yes, lets make such that the teacher can use the AI to create quizes and assignments that test the full 
### 1. Teacher can generate from actual classroom content

From inside a subject/classroom, the teacher selects **Create → AI Quiz, AI Assignment, or AI Examination**.

Ndovera AI should generate questions using the teacher's actual context: class, subject, topics/subtopics selected, curriculum, lesson notes/materials attached to those topics, and the assessment standard selected by the teacher.

The teacher should be able to configure:

| Setting             | Options                                                                                  |
| ------------------- | ---------------------------------------------------------------------------------------- |
| Assessment          | Quiz / Assignment / Test / Examination                                                   |
| Topics              | One, multiple, or all taught topics                                                      |
| Standard            | School / WAEC / NECO / IGCSE / SAT / Custom                                              |
| Difficulty          | Easy / Standard / Hard / External Exam / Mixed                                           |
| Number of questions | Teacher selects                                                                          |
| Question types      | MCQ / True-False / Fill-in / Short Answer / Structured / Essay / Calculation / Practical |
| Total marks         | Teacher specifies                                                                        |
| Duration            | Teacher specifies                                                                        |
| Bloom's levels      | Automatic / Custom distribution                                                          |
| Source              | Topics / Notes / Materials / Curriculum / Combination                                    |
| Answers             | Generate automatically                                                                   |
| Marking scheme      | Generate automatically                                                                   |
| Delivery            | Online / Printable / Both                                                                |

---

# 2. Full Bloom's Taxonomy Coverage

The generator should tag every question internally according to its cognitive level.

| Bloom's Level  | What Ndovera Tests      | Typical Question Style        |
| -------------- | ----------------------- | ----------------------------- |
| **Remember**   | Recall facts            | Define, state, list, identify |
| **Understand** | Explain meaning         | Explain, describe, summarise  |
| **Apply**      | Use knowledge           | Calculate, demonstrate, solve |
| **Analyse**    | Examine relationships   | Analyse, compare, distinguish |
| **Evaluate**   | Make reasoned judgments | Assess, justify, evaluate     |
| **Create**     | Produce something new   | Design, develop, propose      |

The teacher should see a **Bloom's Coverage Meter** before publishing.

For example:

| Level      | Questions | Marks  | Coverage |
| ---------- | --------- | ------ | -------- |
| Remember   | 5         | 5      | 10%      |
| Understand | 5         | 10     | 15%      |
| Apply      | 6         | 15     | 20%      |
| Analyse    | 5         | 20     | 20%      |
| Evaluate   | 3         | 20     | 20%      |
| Create     | 1         | 10     | 15%      |
| **Total**  | **25**    | **80** | **100%** |

The teacher can change the distribution.

For senior/external-exam classes, Ndovera should automatically give significant weight to **Apply, Analyse and Evaluate**, rather than producing an examination dominated by simple recall.

---

# 3. Higher-Order Thinking Question Engine

This is especially important.

Ndovera should not simply take a note and turn sentences into questions. It should be capable of generating **unfamiliar scenarios, data interpretation, case studies, calculations, comparison questions, source-based questions and problems requiring students to transfer knowledge**.

Authentic assessment that requires students to transfer knowledge is particularly useful for eliciting higher-order thinking. [teaching.cornell.edu](https://teaching.cornell.edu/teaching-resources/assessment-evaluation/promoting-academic-integrity-your-course?utm_source=chatgpt.com)

For example, instead of only:

> Define scarcity.

Ndovera could generate a scenario where a government has limited funds and competing demands for education, healthcare and roads, then ask students to **analyse the choices, identify opportunity costs and justify an allocation decision**.

That tests whether the student actually understands Economics.

---

# 4. Intelligent MCQ Answer Randomisation

I strongly agree with your point about predictable answers.

The system should **not** simply randomly shuffle A–D independently, because pure randomness can still accidentally produce obvious patterns.

Instead, Ndovera should use a **constrained randomisation algorithm**.

For example:

`A, C, B, D, B, A, D, C, A, B...`

Rules should include:

- The same correct option should **never appear three times consecutively**.
- Avoid obvious patterns such as A-B-C-D-A-B-C-D.
- Avoid excessive concentration on one option.
- Keep A/B/C/D distribution reasonably balanced across the assessment.
- Shuffle distractors without changing their meaning.
- Run a final pattern-detection check before publishing.

Also, every distractor should be **plausible**. The AI should reject silly or obviously wrong distractors that allow students to guess without knowing the subject.

---

# 5. Teacher Editing Before Publishing

AI generation must **never automatically publish** an assessment.

The workflow should be:

**Generate → AI Quality Check → Teacher Review → Edit → Preview → Approve → Schedule/Post**

Every generated question should have controls for:

**Edit | Delete | Regenerate | Duplicate | Move | Change Marks | Change Bloom Level | Change Difficulty**

Teachers should also be able to manually add their own questions.

---

# 6. AI Quality-Control Pass

Before presenting an assessment to the teacher, Ndovera should automatically inspect it for:

| Check                | What AI verifies                                  |
| -------------------- | ------------------------------------------------- |
| Curriculum alignment | Questions are within selected curriculum/topics   |
| Topic coverage       | Required topics are represented                   |
| Bloom coverage       | Cognitive levels meet target                      |
| Difficulty           | Appropriate for selected class/exam               |
| Duplication          | No substantially repeated questions               |
| MCQ validity         | Exactly one defensible best answer where required |
| Distractors          | Plausible and non-trivial                         |
| Answer pattern       | No predictable A/B/C/D sequence                   |
| Ambiguity            | Questions have sufficient information             |
| Marks                | Marks match expected response depth               |
| Command words        | Appropriate examination terminology               |
| Calculations         | Values and solutions are internally consistent    |
| Mark scheme          | Corresponds to each question                      |
| Language             | Appropriate for student level                     |

The AI can show warnings rather than silently changing important teacher decisions.

---

# 7. Schedule or Post Immediately

After teacher approval:

### Post Now

Students immediately see the quiz/assignment in their classroom.

### Schedule

Teacher selects:

**Opening date/time → Closing date/time → Duration → Attempts → Late-submission policy**

Ndovera publishes it automatically at the scheduled time.

---

# 8. Full AI Examination Paper Generator

This should be a separate, more controlled mode:

## **Ndovera AI Exam Builder**

The teacher selects:

**Class → Subject → Term/Session → Topics/Curriculum → Examination Standard → Paper Structure**

For examination standard:

**WAEC | NECO | IGCSE | SAT | School Standard | Custom**

One important implementation detail: don't tell the AI merely to make something “WAEC hard” or “IGCSE hard.”

Ndovera should maintain **assessment profiles** defining the expected question structure, command words, cognitive demand, marks and question styles for each examination system. For Cambridge-style assessment, for example, official guidance emphasizes understanding command words and using past/specimen papers and mark schemes to understand assessment objectives. [Cambridge International](https://www.cambridgeinternational.org/support-and-training-for-schools/support-for-teachers/teaching-and-assessment/?utm_source=chatgpt.com)

---

# 9. Exam Blueprint Before Generation

Before generating the actual examination, Ndovera should first create an **Exam Blueprint**.

For example:

### SS2 Economics — First Term Examination

| Section   | Question Type   | Questions | Marks   | Cognitive Demand |
| --------- | --------------- | --------- | ------- | ---------------- |
| A         | Multiple Choice | 40        | 40      | Remember–Analyse |
| B         | Data/Structured | 5         | 30      | Apply–Analyse    |
| C         | Essay           | 3 of 5    | 30      | Analyse–Evaluate |
| **Total** |                 |           | **100** |                  |

Then:

### Topic Coverage

| Topic                      | Target Marks |
| -------------------------- | ------------ |
| Basic concepts             | 10           |
| Tools of economic analysis | 20           |
| Demand and supply          | 25           |
| Production                 | 20           |
| Market structures          | 25           |
| **Total**                  | **100**      |

The teacher approves or modifies the blueprint **before AI writes the paper**.

This will greatly improve examination quality.

---

# 10. Automatic Marking Scheme

Ndovera should generate **two separate documents**:

### Student Examination Paper

No answers.

### Teacher Marking Scheme

Contains:

- correct MCQ answers;
- expected answers;
- marking points;
- allocation of marks;
- acceptable alternative responses;
- calculation steps where relevant;
- rubric for essays/extended responses;
- Bloom level;
- topic tested.

The marking scheme must **never be accessible to students before the assessment is completed and released by the teacher**.

---

# 11. Professional School Examination Formatting

Yes, Ndovera can generate a completely print-ready examination.

The administrator should first configure an **Exam Letterhead Template** for the school.

It could automatically produce:

**[SCHOOL LOGO]**

**GENESIS INTERNATIONAL SCHOOL**

**FIRST TERM EXAMINATION — 2026/2027 SESSION**

| Field         | Information                                          |
| ------------- | ---------------------------------------------------- |
| Subject       | Economics                                            |
| Class         | SS2                                                  |
| Duration      | 2 Hours                                              |
| Total Marks   | 100                                                  |
| Date          | \_\_\_\_\_\_\_\_\_\_                                 |
| Student Name  | \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ |
| Admission No. | \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ |

Then:

**INSTRUCTIONS TO CANDIDATES**

followed by properly numbered **SECTION A, SECTION B, SECTION C**, tables, diagrams, graphs, answer spaces and page numbering.

The paper should be exportable as **PDF and DOCX** and be immediately suitable for printing.

For an IGCSE-inspired formatting profile, it is worth following current accessibility principles such as left-aligned text, clear tables and figures, restrained italics and consistent formatting. Cambridge introduced such question-paper design changes from 2026. [Cambridge International](https://www.cambridgeinternational.org/exam-administration/cambridge-exams-officers-guide/phase-4-before-the-exam/accessible-design-changes-to-question-papers-from-2026/?utm_source=chatgpt.com)

---

# 12. Teacher Review + Print Preview

Before submission, the teacher sees the examination exactly as it will print.

There should be:

**Edit Questions | Reorder | Add Question | Delete | Regenerate Question | Adjust Marks | Insert Page Break | Preview Paper | Preview Marking Scheme**

And importantly:

### **Run Final Exam Audit**

Ndovera AI performs one final check and reports something like:

**Curriculum coverage:** 100% ✓\
**Total marks:** 100/100 ✓\
**Bloom coverage:** Balanced ✓\
**Higher-order questions:** 46% ✓\
**Duplicate questions:** None ✓\
**MCQ answer distribution:** Balanced ✓\
**Answer-pattern risk:** Low ✓\
**Unanswered/invalid questions:** None ✓\
**Mark scheme:** Complete ✓\
**Print layout:** Ready ✓

The teacher still makes the final decision.

---

# 13. Submit to Existing Exam Submission Path

This is important because we should **not create another disconnected examination workflow**.

Once the teacher has finished reviewing the paper:

**Save Draft → Finalise → Submit as Exam Question**

Ndovera sends the finished paper through the school's **existing examination-question submission path**.

It should include:

**Exam paper + marking scheme + subject + class + term + session + teacher + date submitted + version number**

The normal approval process can then continue:

**Teacher → HOD/Subject Head → Exam Officer/Administrator → Approved for Printing**

depending on the school's configured workflow.

---

# 14. Version Control

Exam papers should never simply be overwritten.

For example:

**Economics SS2 First Term**

`Draft v1 → AI Generated`

`Draft v2 → Teacher Edited`

`v3 → Submitted`

`v4 → HOD Corrections`

`FINAL → Approved`

Every change should have:

**Who changed it | What changed | Date/time**

This is particularly important for examination security.

---

# 15. Ndovera AI Assessment Architecture

I would therefore add **three connected AI assessment tools**:

| Tool                      | Purpose                                             |
| ------------------------- | --------------------------------------------------- |
| **AI Quiz Builder**       | Quick classroom assessments, auto/manual marking    |
| **AI Assignment Builder** | Homework, projects and higher-order tasks           |
| **AI Exam Builder**       | Formal, printable examinations with marking schemes |

All three use the same underlying:

**Curriculum Engine + Topic System + Teacher Materials + Bloom Engine + Assessment Standard Profiles + Question Quality Engine + Ndovera AI**

This means when a teacher has already created topics and attached notes/materials—as we designed earlier—the teacher could simply open **“History of Economics” → Create with Ndovera AI → Quiz**, and Ndovera already knows the class, subject, topic, materials and curriculum from which the assessment should be generated.

That integration is much stronger than making the teacher repeatedly explain the subject and topic to the AI.

### N7. Simplified Fee Engine — set up a term's fees in under two minutes — ✅ DONE AND COMPLETED (5 Oct 2026)
Built: Finance → Fees & Billing (Owner, HOS) and Accountant → Fees & Billing. Finance tabs are now: Fees & Billing · Subscription · Fee Template · Channels · Claims · Expenditure · Income & Exp. · AI Analysis (Term Fees removed from the menu; its bills still show on student accounts).
- Dashboard: Expected · Collected · Outstanding · Collection Rate, and Set Up / Edit Fees · Record Payment · Student Accounts · Reports. When a term has no fees it shows "Set up <term> fees" with Reuse last term (recommended) · Start New · Use Saved Template.
- Fee Setup: every class × every fee item in one editable table, + Add Fee Item, Save Fees. Click an item for Edit All: same amount / increase % / reduce % / individually, with a preview. Lock makes fees official and creates every student's account; Unlock to edit.
- Changes after billing ask: apply the difference to affected students (audited adjustments) or future students only.
- Student accounts: Term Fee + Outstanding + Charges − Discounts = Total Payable; Paid; Balance; Paid · Part Payment · Unpaid · Overpaid. Outstanding Fee opens its history (source term, original, carried forward).
- Student account page: Record Payment · Add Charge · Give Discount · Credit · Print Statement; reasons required and audited.
- Record Payment: student, amount, method, optional reference/note, date (today). Earlier balances are paid first; extra stays as credit. Receipt issued automatically.
- Settings → Who can change fees: Owner only / Owner + HOS / Owner + Accountant / all three (Owner always). Payments are not affected.
- New students after locking: "Create fee account" at the class's standard fee. Students who move class: Keep existing / Apply new class difference / Custom adjustment.
- Every finished term's fees can be reused next term — no templates to manage.
Backend `feeEngine.ts`; tests `simple-fees.test.mjs`, `SimpleFees.test.jsx`.
- Fixed 6 Oct 2026: if a term ever has no usable start date, the moment its fees were first billed is used to split Outstanding from this term's payments (all live terms have valid dates).

### N8. Ndovera AI page, paper structure, figures, A4 printing and letterhead — ✅ DONE AND COMPLETED (6 Oct 2026)
- "AI Assistant" is now **Ndovera AI** for every role. Teachers get two tabs: Chat and **Ndovera AI Assessment** (the old /roles/teacher/ai-assessments link redirects there; topic links go straight to the Assessment tab).
- Fixed "Subject not found for this class": changing class now picks that class's first subject before asking the server.
- Paper structure set by the teacher (create form and exam blueprint): per section — question type, number of questions (up to 120), answer All / Any n, marks per question, parts (a)–(f), compulsory question numbers, and an instruction that writes itself ("Question 1 is compulsory. Answer any 4 other questions.") or can be typed. Presets for quiz, assignment, test and WAEC / NECO / IGCSE / SAT exams.
- Questions with parts: each part has its own prompt, marks, answer and marking points; the teacher can add, edit or remove parts and mark a question compulsory. The exam audit marks compulsory + best of the rest.
- Figures: graphs of functions, line / bar / scatter / pie charts, geometry (triangles, circles, angles), electric circuits and number lines are drawn by Ndovera from ```figure blocks — the AI writes them for Physics, Maths, Chemistry, Economics etc., and teachers insert or edit them with "📈 Graph / Diagram" in the toolbar. They print and export to Word.
- Printing: all pages on A4, page breaks between questions, smaller margins, no browser date/title line (the "Printed …" stamp is only at the end of the paper). Questions bold, options normal weight.
- Letterhead: one band no taller than 1 inch — school logo (from school branding), name in the school colour, motto, address · contact — on screen, in print and in the .docx. Owner/HOS can set contact and colours on the letterhead page, with a live preview.
Tests: `ai-assessments.test.mjs`, `figures.test.js`, `paperStructure.test.js`, `printPaper.test.js`, `PaperPreview.test.jsx`, `docxExport.test.js`.

### N9. A unique paper for every student, without AI — ✅ DONE AND COMPLETED (6 Oct 2026)
- Objective questions swap places within their section and MCQ options are shuffled per student (true/false and "All of the above"-type options stay put). Theory questions keep their numbers, so "Question 1 is compulsory" stays true.
- Numbers can vary per student: {{d=100..300}}, {{m=0.5..4.5 step 0.5}}, {{d}}, {{= d/t}}, {{= d/t :1}} (sin/cos/tan in degrees). The preview, print and Word file show the master paper (lowest values).
- Online: each student always gets the same paper back and is marked with their own key; the teacher sees each student's own paper beside their answers.
- Printed: Unique papers tab — versions A, B, C… (2–8) or one paper per student (name and admission number printed), each with a paper code and its own answer key.
- Secondary classes (JSS/SS, Year 7–13, Grade 7–12, Basic 7–9) get unique papers by default for exams; teachers can switch it on for quizzes and tests.
Backend `paperVariants.ts`; tests in `ai-assessments.test.mjs`, `uniquePapers.test.jsx`.

### N10. Exams: CBT objectives + printed theory, HOS scheduling, marking and posting to the score sheet — ✅ DONE AND COMPLETED (6 Oct 2026)
- Teacher Exams page: new paper with Ndovera AI, or typed / pasted / uploaded (Word read in the browser with its numbering; PDF read on the server). Ndovera reads numbered questions, A–D options, answer keys (key at the end, "Answer: B", or an asterisk), sections and instructions ("answer any three", "Question 1 is compulsory"), (a)(b)(c) parts and marks; Ndovera AI helps when the layout is unusual. Nothing is guessed — MCQs without a key must be ticked before submitting. "Draft missing marking guides with Ndovera AI" for theory.
- Raw file uploads for "Exam Questions" in Submit Work are no longer accepted; it points to the Exams page.
- HOS approval chooses: Printed paper / CBT (whole paper) / CBT objectives + printed theory, with open time, close time, minutes per student, and unique papers. HOS/Owner can move a CBT before it opens (HOS Exams page).
- Students see a CBT on their Exams page only during its window; the server's clock runs it; time up submits; answers are kept on the device against refreshes. Once written it disappears.
- Teacher "Mark & post scores": objectives from the CBT (cannot be overwritten), theory typed by the teacher (or both for a printed paper); whole-paper CBT shows each student's typed answers with the marking guide. "Post scores" writes the exam column of the CA score sheet, keeping CA marks: by default (objective + theory) ÷ paper total × exam max (e.g. 59 + 30 = 89/100 → 53.4/60), or as obtained — set in Result Settings with rounding. Absent students are left blank; missing theory marks are confirmed first.
- After posting, the paper appears in the student's Assignments tab with their answers, the correct answers and the marking guide.
- Also fixed: the exam audit wrongly failed every question with parts; a question made only of parts (no stem) is valid; the old CBT engine no longer sends answers to students, and students submit only as themselves.
Backend `paperImport.ts`, `examSittings.ts`; tests `exam-sittings.test.mjs`, `examSittings.test.jsx`.

### N11. HOS downloads all exam papers; every term's submitted work is visible — ✅ DONE AND COMPLETED (6 Oct 2026)
- HOS Exams page → Download exam papers: Approved / Awaiting approval / All, with or without marking schemes → one ZIP, a folder per class, each paper (and scheme) as a Word file. Older "Exam Questions" submissions come with their text and attached files (any file that cannot be fetched is listed with its link).
- Fixed: Teacher Submissions (review) only ever showed work stamped with the current term, so work from earlier terms — or saved before the academic calendar was set up — was hidden. It now shows Everything by default, with This session / This term and From–To dates; each item shows its session and term. "Not submitted", missing and late stay about the current term.
Tests: `teacher-submissions.test.mjs`, `exam-sittings.test.mjs`, `examPapersDownload.test.js`, `SubmissionReviewPage.test.jsx`.


### N12. Teacher Submissions & Compliance — ✅ DONE AND COMPLETED (7 Oct 2026)
- Owner/HOS set requirements once (Lesson Notes, Exam Questions, Register, Diary, Class Report, C.A. Scores, custom): who (all/nursery/primary/secondary), weekly/monthly/termly/once/every N days, due day and time, Ndovera/manual/either, approval, late allowed, fine and grace period, start/end. Ndovera works out every period itself.
- Evidence is counted automatically: register from the class teacher's attendance for each school day; lesson notes and exam questions per subject and class taught (7/9 — missing: …); class reports; C.A. hand-in. Heads mark paper work as submitted, or upload it on the teacher's behalf ("Submitted by the Principal on Mrs James's behalf"). Statuses: done (auto/manual), late, partial, due, missing.
- Fines are proposed after the grace period, never charged: the Owner/HOS approve, waive or adjust with a reason. Every manual change is in the audit trail.
- Weekly Class Report: school-editable questionnaire (short/long/number/yes-no/choice/student picker/file), Ndovera AI write-up the teacher edits before submitting; Heads see the answers and the report side by side.
- Teacher: "My Submissions" card on the dashboard + page with what is missing and a link to complete it, and a permanent weekly history. Heads: Submissions & Compliance — totals, teacher × requirement matrix, filters, drill-down, history. Section heads (Nursery Head, Headteacher, Principal/VP — configurable) see their own section.
- Reminders in the header (due within a day, overdue) and a cached weekly summary for the Owner/HOS; morning emails (see N15).
Tests: `compliance.test.mjs`, `compliance.test.jsx`.
Yes. This should become a Teacher Submissions & Compliance module in Ndovera, rather than separate disconnected features. The key is that Ndovera should recognize work already completed inside the platform, while still allowing Heads of Section (HOS) to confirm work completed physically/offline.
Ndovera — Teacher Submissions & Compliance
The school Owner/HOS should be able to create submission requirements and decide who submits, how often, the deadline, whether approval is required, and whether late submission attracts a fine.
1. Submission configuration
Under Administration → Teacher Submissions, the Owner/HOS gets a simple setup such as:
Setting	Example
Submission	Lesson Notes
Applies to	All Teachers / Nursery / Primary / Secondary
Frequency	Weekly
Due day	Friday
Due time	4:00 PM
Submission method	Ndovera / Manual verification / Either
Approval required	Yes
Late submission	Allowed
Fine	₦1,000
Grace period	24 hours
Starts	12 Oct 2026
Ends	End of Term


Frequency should support weekly, monthly, termly, once, or custom.
For one-time submissions, the school simply chooses a specific deadline—for example, First Term Examination Questions — 13 November 2026, 4:00 PM.
2. Register / Attendance
The Register requirement should integrate directly with the existing attendance system.
If the teacher marks the required attendance in Ndovera for the week:
Register — ✓ Completed automatically
No extra submission should be necessary.
If the school still uses a physical register, the Nursery Head, Headteacher, Principal or other authorized HOS can select:
Mark as Submitted
Ndovera records who confirmed it and when.
The system should distinguish:
Auto-verified • Manually verified • Pending • Late • Missing
This prevents teachers from doing the same work twice.
3. Diaries
Diary submission can primarily be a verification requirement.
The teacher's weekly dashboard could show:
Diary — Due Friday, 4:00 PM — Pending
The appropriate HOS can mark:
✓ Diary checked/submitted
Optionally, the school can enable file/photo upload where it wants digital evidence.
4. Lesson Notes
This should connect directly to the lesson-note functionality already being built.
When a teacher submits the required lesson notes through Ndovera, Ndovera automatically updates:
Lesson Notes — ✓ Submitted
If lesson notes are submitted physically, the HOS can manually mark them submitted.
More importantly, Ndovera should understand partial completion.
For example:
Lesson Notes — 7/9 completed
Missing: Basic Science Week 6, Mathematics Week 6

So a teacher cannot receive a green "Submitted" status simply because one lesson note was uploaded.
5. Examination Questions — subject-level tracking
This needs more detailed logic because a teacher may teach several subjects.
Suppose Mrs. James teaches:
- Mathematics — JSS 1
- Mathematics — JSS 2
- Basic Science — JSS 1
- Basic Science — JSS 2
When examination questions become due, Ndovera automatically creates four requirements.
Her dashboard shows something like:
Exam Questions — First Term Examination
3 of 4 submitted — PARTIAL
✓ JSS 1 Mathematics
✓ JSS 2 Mathematics
✓ JSS 1 Basic Science
❌ JSS 2 Basic Science
The missing subject/class must be clearly displayed.
Teachers can upload the questions themselves, or an authorized HOS can upload/confirm them on the teacher's behalf.
The system records:
Submitted by: Principal
On behalf of: Mrs. James
Date: 12 Nov 2026, 10:42 AM

This preserves accountability.
Late submission and fines
The school should be able to configure penalties.
For example:
Deadline: Friday 4:00 PM
Grace period: 24 hours
Fine after grace period: ₦1,000

Ndovera should calculate but not silently deduct fines.
Status becomes:
🔴 Late — ₦1,000 penalty proposed

An authorized HOS/Owner can then approve, waive or adjust it, with the reason recorded in the audit trail.
This is safer than automatically charging teachers for every system-detected lateness.
6. Class Reports
I would make this a major feature rather than simply an upload box.
Go to:
Classroom → Reports → Weekly Class Report
The school creates a questionnaire/template that teachers complete.
Questions could cover attendance trends, academic progress, topics covered, struggling pupils, outstanding students, behaviour/discipline, parent concerns, homework, resources needed, incidents, achievements and recommendations.
Questions can support:
Short text • Long text • Number • Yes/No • Multiple choice • Student selector • File attachment
The school should be able to edit these questions.
AI report generation
After the teacher completes the questionnaire, Ndovera AI can transform the raw answers into a professionally formatted weekly report.
The teacher should see the generated report before final submission and be able to correct it.
Once submitted:
Weekly Class Report — ✓ Submitted

HOS sees both:
Teacher's original questionnaire responses
and
AI-generated summary
This is important because AI should summarize the teacher's information rather than become the source of record.
HOS/Owner Reporting Centre
Heads should not have to open every teacher individually.
Create:
Management → Submissions
At the top:
Week 5 — Teacher Compliance
42 Teachers
35 fully compliant
5 partial
2 outstanding
7 late submissions
₦4,000 proposed penalties

Then provide a matrix:
Teacher	Register	Diary	Lesson Notes	Exam Questions	Class Report
Mrs James	✓	✓	✓	3/4	✓
Mr John	✓	❌	✓	✓	✓
Mrs Grace	✓	✓	7/9	✓	Late
Mr Peter	✓	✓	✓	✓	✓


Clicking 3/4 immediately shows the missing subject.
Clicking 7/9 shows the missing lesson notes.
The HOS should be able to filter by week, teacher, section, class, submission type, status and lateness.
Teacher Dashboard
Teachers need something much simpler.
I suggest a card called:
My Submissions
This Week — Week 5
🟢 Register — Done automatically
🟢 Diary — Verified
🟡 Lesson Notes — 7/9 submitted
🔴 Exam Questions — 3/4 submitted
🟢 Class Report — Submitted
2 items require attention

Then:
View Missing Items
This takes the teacher directly to whatever needs completing.
Don't make teachers search through several menus to discover what they have not submitted.
Automatic weekly generation
This should be driven by a Submission Requirement Engine.
The administrator defines a rule once:
Lesson Notes
Secondary Teachers
Weekly
Every Friday
4:00 PM

Ndovera then generates the requirements every week automatically.
Therefore, HOS doesn't create "Lesson Notes Week 1", "Lesson Notes Week 2", etc.
The system does that.
For a one-time requirement:
First Term Examination Questions
Due 13 November
4:00 PM

Ndovera generates it once.
Permissions
This should follow the school hierarchy.
Owner: Full configuration, visibility, overrides, fine approval/waiver and audit access.
HOS: School-wide operational oversight where permitted.
Nursery Head: Nursery teachers only.
Headteacher: Primary teachers only.
Principal: Secondary teachers only.
Teacher: Own requirements/submissions only, except where another role explicitly grants additional access.
Permissions should be scope-based, not just title-based, because different schools organize leadership differently.
Notifications
Ndovera should automatically remind teachers.
For example:
Thursday 4:00 PM
You have 2 submissions due tomorrow.

Then:
Friday 2:00 PM
Lesson Notes and Class Report are due by 4:00 PM.

After deadline:
Examination Questions are overdue.
Missing: JSS 2 Basic Science.

HOS can receive a summary rather than dozens of notifications:
Weekly Submission Summary
35/42 teachers compliant
5 partial
2 outstanding

One important addition: Submission History
Every teacher should have a permanent Compliance History.
For example:
Week	Required	On Time	Late	Missing
Week 1	4	4	0	0
Week 2	4	3	1	0
Week 3	5	4	0	1
Week 4	4	4	0	0


This becomes extremely useful during staff appraisal because management can see actual submission records rather than relying on memory.
Every manual status change should also have an audit record: who changed it, previous status, new status, date/time, and optional reason.
The overall design principle should be:
If Ndovera already has evidence that the teacher completed the work, mark it automatically. If the work happened outside Ndovera, let an authorized Head verify it. If only part of the requirement is complete, show exactly what is missing.

That will make this module useful without creating additional administrative work for teachers.



### N13. Digital Staff Office File — ✅ DONE AND COMPLETED (7 Oct 2026)
- One file per member of staff at /roles/<role>/staff/<id> ("My Staff File" in the menu), opened from People, the compliance matrix and classroom profiles. Overview: this week (submissions, attendance, tasks, review, loan balance, rewards), Requires Attention, recent activity, badges.
- Records (employment and role history, documents, qualifications, training, leave, disciplinary, assets, contacts, next of kin, salary, exit, notes): never overwritten — an edit is a new version, the old kept in History. Visibility per record: staff-visible, management only, private (staff member, HoS, Owner, Accountant), owner only.
- Loans: apply, review, approve/decline, disburse; record loans from before Ndovera; "I have paid" waits for the Accountant/HOS/Owner to confirm; balance only moves by confirmed repayments, adjustments and reasoned waivers; statement and clearance statement.
- Tasks with progress, evidence and evaluation (Outstanding … Unsatisfactory, score); formal performance reviews (staff see scores and comments, not internal notes) beside peer-review averages; reports about staff with the full workflow, reporter hidden from the staff member, no adverse finding before their response; rewards with printable certificates; payroll, attendance, submissions, activity timeline and audit trail.
Tests: `staff-file.test.mjs`, `staffFile.test.jsx`.
This should evolve into a Digital Staff Office File and, in parallel, a Digital Student File. Clicking a person's name anywhere in Ndovera should open the same authoritative profile rather than creating separate records in payroll, submissions, loans, reports, etc.
1. Staff Digital Office File
Clicking a teacher/staff member's name should open:
Staff Profile → Overview | Employment | Documents | Submissions | Tasks | Reviews | Reports | Loans | Finance | Attendance | Leave | Rewards | Disciplinary | Training | Activity
The Overview becomes a management snapshot showing photo, staff ID, position, department/section, employment status, date employed, classes/subjects taught, attendance, current tasks, weekly submission compliance, latest review score, outstanding loan, rewards, warnings/disciplinary status and recent activity.
Access must depend on role. The staff member sees their own permitted records; HOS sees records within their scope; Owner sees everything; Accountant sees relevant financial records. Sensitive HR records should not automatically be visible to every HOS.
Employment & Documents
This replaces the physical office folder.
Store appointment history, current role, promotions, salary changes where authorized, qualifications, CV, certificates, appointment letter, confirmation letter, ID documents where legally appropriate, emergency/contact information, next-of-kin information, signed policies, contracts, queries/warnings and other HR documents.
Every record should support Add Record, Edit, Attach Document, Date, Notes, Entered By and Audit History.
Never permanently overwrite historical employment information. If a staff member moves from Teacher to Headteacher, Ndovera should retain both records and their effective dates.
2. Loans
Add Staff File → Loans.
A staff member can select Apply for Loan, enter amount requested, purpose, proposed repayment period, preferred monthly repayment and supporting information.
Workflow:
Submitted → Under Review → Approved/Declined → Active → Cleared
If a loan happened outside Ndovera, authorized Owner/HOS/Accountant can use Record Existing Loan and enter the amount, date issued, amount already repaid, balance, repayment arrangement and supporting evidence.
This is important because Ndovera should represent reality rather than requiring every historical transaction to have originated in Ndovera.
For an active loan, show:
Staff Loan #LN-0042
Principal: ₦300,000
Total paid: ₦150,000
Outstanding: ₦150,000
Monthly instalment: ₦50,000
Next payment: 30 October 2026
Status: Active

For installment payments, staff can click I Have Paid and enter amount/date plus optional proof.
That creates Awaiting Confirmation.
Accountant/HOS/Owner verifies it. Only after confirmation should Ndovera reduce the balance.
Authorized management should also be able to directly record a verified payment.
When balance reaches zero:
✓ Loan Cleared — 100% paid
A clearance certificate/statement can then be generated.
Crucially, do not allow someone simply to edit ₦150,000 into ₦0. Every change to the loan balance should originate from a transaction, adjustment or formally recorded waiver so there is a financial audit trail.
3. Tasks & Assignments
Add Staff File → Tasks.
Owner/HOS can assign tasks to an individual or several staff:
Organize Mathematics Laboratory
Assigned by: Principal
Due: 16 October
Priority: High
Status: In Progress

Staff can update progress and submit completion evidence.
Management then chooses Mark Completed and evaluates the quality:
Outstanding / Very Well Done / Well Done / Satisfactory / Needs Improvement / Unsatisfactory
There can also be a score, for example 92/100, and management comments.
That evaluation should become part of the staff's work history and can contribute to appraisal, but the system should not turn one subjective task rating directly into disciplinary action.
4. Staff Reviews
Add Staff File → Reviews with two distinct systems.
Formal Performance Review is completed by authorized management using school-defined criteria such as punctuality, teaching effectiveness, classroom management, lesson preparation, teamwork, communication, professionalism and task completion.
Staff should be able to see their overall score and permitted comments.
For example:
Term 1 Performance Review — 86%
Teaching: 91%
Punctuality: 82%
Professionalism: 88%
Teamwork: 84%

Then add Peer Review, allowing staff to review colleagues where the school enables it.
Management determines whether peer reviews are anonymous to the reviewed staff. Ndovera should still retain the reviewer internally for abuse investigation and audit rather than creating genuinely untraceable accusations.
5. Reports About Staff
This needs careful permissions.
Under Reports, management can see incidents/concerns reported about a staff member, subject to their authorization.
The staff member may see an appropriate version such as:
Report — 5 October 2026
Category: Professional Conduct
Status: Reviewed
Details: ...
Management response: ...

The reporter's identity should not be displayed to the reported staff member where the school's reporting policy protects confidentiality.
However, authorized investigation/audit roles should retain access to the source identity. Otherwise malicious anonymous reporting becomes difficult to investigate.
A report needs statuses such as:
Submitted → Under Review → Staff Response Requested → Investigated → Substantiated/Unsubstantiated → Action Taken → Closed
The staff should normally have an opportunity to provide their response before an allegation becomes a permanent adverse finding.
6. Rewards, Recognition & Achievements
Add Staff File → Rewards.
Management can award:
Certificates, badges, commendations, Employee/Teacher of the Month, punctuality awards, excellent lesson preparation, outstanding task performance, years-of-service awards, innovation awards, student-impact awards and custom awards.
For example:
🏆 Outstanding Teacher Award
Awarded: First Term 2026/2027
Reason: Exceptional classroom performance
Awarded by: Head of School
Certificate: View

Certificates can be generated from school templates and stored permanently in the staff file.
Badges can also appear tastefully on the staff profile.
7. Additional sections I would add
The Digital Office File should also include Leave & Absence, Training/Professional Development, Promotions & Role History, Queries/Warnings/Disciplinary Cases, Attendance/Punctuality History, Salary/Payroll history for authorized users, Assets issued to staff such as laptops/books/keys, Certificates & Qualifications, Emergency/Next-of-Kin information, and Exit/Clearance when someone leaves the school.
The Activity Timeline is particularly important:
7 Oct — Weekly report submitted
6 Oct — ₦50,000 loan payment confirmed
4 Oct — Task completed: Very Well Done
30 Sep — Excellence certificate awarded
28 Sep — Lesson notes approved
25 Sep — Leave request approved

That makes the digital file feel like a real chronological office file.
### N14. Digital Student File (and one person record everywhere) — ✅ DONE AND COMPLETED (7 Oct 2026)
- Every tab works: Overview (academic %, attendance %, outstanding fees, behaviour, awards, open disciplinary cases, assignment completion), Personal, Parents/Guardians, Academic, Results, Attendance, Behaviour, Reports, Health, Fees, Payments (Record payment opens Fees & Billing for the student), Documents, Awards, Disciplinary (cases opened and closed with history), Notes, Activities, Private, Timeline, AI report. Also a page at /roles/<role>/students/<id>.
- Who sees what follows the relation: teachers only for classes they teach; the clinic for health; the accountant for fees; notes never reach families; private records only the student, parents, HoS/Owner and Accountant.
- Fixed: any student with a record made the profile fail (and the daily feed's cached path likewise) — a JSON helper was never in scope.
Tests: `student-file.test.mjs`, `StudentProfilePage.test.jsx`.

8. Fix the Student Profile at the same time
Your point about the student pages being empty is important. No tab should exist merely as decoration.
Clicking View Student should open a functioning Digital Student File:
Overview | Personal | Parents/Guardians | Academic | Results | Attendance | Behaviour | Reports | Health | Fees | Payments | Documents | Awards | Disciplinary | Notes | Activities | Timeline
Authorized users need Add Record / Edit / Upload / Record Payment / Add Note / Add Award / Add Incident, etc., according to permissions.
The Owner should never arrive at an empty page with no mechanism for entering the information the page claims to represent.
The student Overview could immediately show:
Academic: 78%
Attendance: 94%
Outstanding Fees: ₦85,000
Behaviour: Good
Awards: 3
Open disciplinary cases: 0
Assignments: 87% completion

Teachers should only see the parts relevant to their responsibilities, while Owner/HOS and authorized administrators receive broader access.
9. One unified Person Record Architecture
I would strongly recommend that the developer not build all these as unrelated databases.
Use a central person/profile architecture:
Person → Staff Profile / Student Profile → Records
Then modules such as Loans, Attendance, Submissions, Tasks, Reviews, Reports, Rewards, Finance and Documents reference that profile.
Therefore, clicking Mrs. Grace from:
- Teacher Submissions
- Attendance
- Classroom
- Payroll
- Loan
- Task
- Staff List
always opens the same Mrs. Grace staff file.
Similarly, clicking a student's name anywhere should open that student's same Digital Student File.
10. Universal record controls
Almost every record should contain:
Record ID • Type • Date • Status • Created by • Last updated by • Attachments • Notes • Visibility • Approval status • Related record • Audit history
For sensitive records, add:
Who can view this?
This gives Ndovera a proper role- and scope-based permission system instead of simply assuming "Principal can see everything."
11. Privacy boundaries
Some information should deliberately not be shown on the staff-facing version of their file.
For example, investigation material, reporter identity, internal management notes, payroll controls and audit logs may require elevated permissions.
Likewise, an Accountant should not gain access to disciplinary investigations merely because they can confirm loan repayments.
Permissions should therefore work at record level, not just page level.
12. Staff File Dashboard
I would make the finished page look roughly like this:
Mrs. Sarah James — Mathematics Teacher
Active Staff | Staff ID: GIS-0042
This Week
Submissions: 4/5
Attendance: 100%
Tasks: 2 open
Review: 86%
Loan balance: ₦150,000
Rewards: 4
Requires Attention
🔴 Exam Question — JSS 2 Mathematics missing
🟠 Task — Mathematics Lab due tomorrow
🟡 Loan instalment — awaiting payment confirmation
Recent Activity
✓ Class report submitted
✓ Lesson notes approved
🏆 Excellence badge awarded
✓ ₦50,000 loan repayment confirmed

Then the tabs underneath contain the complete office file.
This would turn the current staff/student "View" pages from mostly empty profiles into one of Ndovera's most valuable features: a living digital institutional record of each staff member and student, with the physical office-file concept preserved but made searchable, auditable and connected to everything already happening inside Ndovera.




### N15. C.A. score sheet submission, approval and lock; email reminders; punctuality tips — ✅ DONE AND COMPLETED (7 Oct 2026)
- Teachers hand in each C.A. (or all C.A. at once) per subject from the score sheet once every student has a score; it is then frozen for them. The section head approves or returns it (this meets the compliance requirement); the HoS/Owner give final approval, locking it into the result. Only the HoS/Owner can change it afterwards, with a reason kept in the override log; returned work can be corrected and handed in again.
- New compliance requirement "C.A. Scores" (a given C.A. or all), with deadlines, statuses and fines like the others.
- Morning emails (7–10 a.m. Lagos, one school per run, each once a day): teachers with work due within a day or outstanding; a Monday summary to the Owner and HOS; punctuality tips to staff late on 3+ days in a fortnight (at most once a fortnight).
Tests: `ca-submissions.test.mjs`.
Add C.A score sheet submission to the list so that teachers are expected to enter the scores obtained from C.A. on or before a particular day and submit for sectional head to review and approve then it will mark task as done. then hos/owner can see it and can send it back for review/editing or edit it himself with audit trail. once the hos/owner approves it, it enters the result and cannot be editied again unless the hos/owner edits it with reason. this happens again in the second C.A if a school uses 2 c. a, or as many times as the ca last or the hos/owner can waist for all c.a to be done and recorded before approving it. if deadline is set, then teachers must meet up. Ndovera should send reminders through emails for some major work. a teacher that constantly comes late sjould receive an email from ndovera with tips for how to be punctual to school. dont spoil what is already working perfectly ad let it connect seamlessly

### N16. Tables inside exam questions render as tables — ✅ DONE AND COMPLETED (7 Oct 2026)
- A table written on one line ("… | Variable | Before | After | | --- | --- | --- | | GDP | 100 | 120 | …") is now laid out as a real table, keeping the question text before and after it — in the CBT exam room, paper preview, Word export, marking, classroom assignments, the older exam engine and question banks.
Tests: `richText.test.js`.

The government of a country implements a fiscal policy to stimulate economic growth. The following data shows the impact of the policy on different macroeconomic variables: | Variable | Before Policy | After Policy | | --- | --- | --- | | GDP | 100 | 120 | | Inflation | 2% | 4% | | Unemployment | 5% | 4% | What can be inferred about the effectiveness of the fiscal policy? tables are still not properly resolved in the exam questions


