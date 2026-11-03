#!/usr/bin/env python3
"""Offline, deterministic repository audit. Never reads or writes a database.

Counts are evidence of automated checks, not academic approval. Conservative
similarity holds exclude every member until a human adjudicates the group.
"""
import argparse
import ast
import collections
import csv
import hashlib
import json
import math
import re
from fractions import Fraction
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TYPES = {'mcq', 'structured', 'essay', 'shortanswer', 'comprehension',
         'longanswer', 'fillgaps', 'crossmatching', 'truefalse', 'picture'}
DIFFICULTIES = {'easy', 'standard', 'difficult'}
COGNITION = {'remember', 'understand', 'apply', 'analyse', 'evaluate', 'create'}


def normalize(text):
    # Preserve mathematical operators: x+2 and x-2 are different questions.
    return re.sub(r'\s+', ' ', str(text).casefold().translate(
        str.maketrans({'−': '-', '–': '-', '’': "'"}))).strip()


def option_key(text):
    # Case is meaningful in genotype notation, chemical symbols and SI units.
    return re.sub(r'\s+', ' ', text).strip()


def signature(q, numeric=False):
    text = normalize(str(q.get('prompt', '')) + '\n' + str(q.get('passage', '')))
    text = re.sub(r'^(?:for )?(?:waec|jamb)(?: mathematics)?[:,]?\s*', '', text)
    if numeric:
        text = re.sub(r'\d+(?:\.\d+)?', '#', text)
    return text


def canonical_subject(exam, value):
    value = value.strip()
    if exam == 'NERDC':
        value = re.sub(r'^(?:Primary|JSS|SS|Nursery)\s+', '', value)
    if value in {'Accounting', 'Accounts - Principles of Accounts'}:
        return 'Financial Accounting'
    if value == 'Math':
        return 'Mathematics'
    if exam == 'JAMB' and value == 'English Language':
        return 'Use of English'
    return value


def arithmetic(expression):
    """Fraction arithmetic only; never eval author-supplied code."""
    if not isinstance(expression, str) or len(expression) > 160:
        raise ValueError('arithmetic expression missing/too long')
    def visit(node):
        if isinstance(node, ast.Constant) and type(node.value) in (int, float):
            return Fraction(str(node.value))
        if isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.UAdd, ast.USub)):
            return visit(node.operand) * (-1 if isinstance(node.op, ast.USub) else 1)
        if isinstance(node, ast.BinOp):
            a, b = visit(node.left), visit(node.right)
            if isinstance(node.op, ast.Add): return a + b
            if isinstance(node.op, ast.Sub): return a - b
            if isinstance(node.op, ast.Mult): return a * b
            if isinstance(node.op, ast.Div): return a / b
            if isinstance(node.op, ast.Pow) and b.denominator == 1 and abs(b) <= 12:
                return a ** int(b)
        raise ValueError('unsupported arithmetic')
    return visit(ast.parse(expression, mode='eval').body)


def check_question(q, objectives):
    errors = []
    for key in ('id', 'exam', 'examType', 'curriculum', 'level', 'subject', 'topic',
                'type', 'prompt', 'answer', 'source', 'status', 'license'):
        if not isinstance(q.get(key), str) or not q[key].strip():
            errors.append('missing_or_invalid:' + key)
    if not isinstance(q.get('type'), str) or q.get('type') not in TYPES: errors.append('unsupported_type')
    if q.get('status') != 'draft': errors.append('review_gate:must_remain_draft')
    if q.get('source') != 'original' or q.get('license') != 'original-content':
        errors.append('originality_declaration_missing')
    if q.get('difficulty') not in DIFFICULTIES: errors.append('difficulty_missing_or_invalid')
    if q.get('cognitiveDemand') not in COGNITION: errors.append('cognitive_demand_missing_or_invalid')
    if not isinstance(q.get('explanation'), str) or not q.get('explanation', '').strip():
        errors.append('explanation_missing')
    score = q.get('score')
    if type(score) not in (int, float) or not math.isfinite(score) or not 0 < score <= 100: errors.append('invalid_score')
    if q.get('type') == 'mcq':
        options = q.get('options')
        if not isinstance(options, list) or len(options) != 4 or any(
                not isinstance(v, str) or not v.strip() for v in options):
            errors.append('mcq_requires_four_text_options')
        else:
            if len(set(map(option_key, options))) != 4: errors.append('duplicate_options')
            letter = q.get('correctOption')
            if letter not in ('A', 'B', 'C', 'D') or options[ord(letter)-65] != q.get('answer'):
                errors.append('answer_option_mismatch')
        if q.get('exam') in {'IELTS', 'TOEFL'} and q.get('subject') in {'Writing', 'Speaking'}:
            errors.append('skill_format_mismatch:mcq_not_a_production_task')
    elif q.get('type') in ('structured', 'essay', 'longanswer', 'comprehension'):
        guide = q.get('markingGuide')
        if not isinstance(guide, list) or not guide: errors.append('marking_guide_missing')
        elif any(not isinstance(g, dict) or type(g.get('marks')) not in (int, float)
                 or g['marks'] <= 0 or not g.get('description') for g in guide):
            errors.append('marking_guide_requires_positive_marks_and_criteria')
        elif sum(g['marks'] for g in guide) != q.get('maxMarks'): errors.append('marking_total_mismatch')
        if score is not None and q.get('maxMarks') != score: errors.append('max_marks_mismatch')
    if q.get('exam') == 'JAMB' and q.get('type') != 'mcq': errors.append('jamb_format_mismatch')
    if q.get('exam') == 'NERDC' and not re.fullmatch(
            r'(?:Nursery [1-3]|Primary [1-6]|JSS [1-3]|SS [1-3]|Pre-Nursery)', q.get('level', '')):
        errors.append('class_assignment_unresolved')
    obj = objectives.get(q.get('objectiveId')) if isinstance(q.get('objectiveId'), str) else None
    if not obj: errors.append('objective_mapping_missing')
    else:
        for field in ('exam', 'subject', 'topic', 'subtopic', 'learningObjective', 'specificationId'):
            if q.get(field) != obj.get(field): errors.append('mapping_mismatch:' + field)
        if q.get('type') not in obj.get('questionTypes', []): errors.append('objective_format_mismatch')
        if obj.get('level') and q.get('level') != obj['level']: errors.append('objective_class_mismatch')
    if q.get('academicReview') != {'status': 'pending', 'reviewer': None}:
        errors.append('independent_review_evidence_missing_or_invalid')
    minimum_words = q.get('minimumResponseWords')
    if minimum_words is not None:
        if type(minimum_words) is not int or minimum_words < 1:
            errors.append('invalid_minimum_response_words')
        elif len(str(q.get('answer', '')).split()) < minimum_words:
            errors.append('model_answer_below_required_word_count')
        if q.get('modelAnswerWordCount') != len(str(q.get('answer', '')).split()):
            errors.append('model_answer_word_count_mismatch')
    if q.get('responseMode') == 'spoken' and not q.get('requiresRecordingOrLiveExaminer'):
        errors.append('spoken_response_requires_performance_evidence')
    claims = q.get('verification', [])
    if not isinstance(claims, list):
        errors.append('verification_must_be_array'); claims = []
    for claim in claims:
        try:
            result = arithmetic(claim['expression'])
            if result != Fraction(str(claim['expected'])): errors.append('arithmetic_claim_incorrect')
            if claim.get('answerValue') is not None and result != Fraction(str(claim['answerValue'])):
                errors.append('arithmetic_answer_mismatch')
            if not claim.get('purpose'): errors.append('arithmetic_claim_purpose_missing')
        except (ValueError, KeyError, TypeError, SyntaxError, ZeroDivisionError, OverflowError):
            errors.append('invalid_arithmetic_claim')
    if (q.get('exam') == 'SAT' and q.get('subject') == 'Mathematics'
            and q.get('type') == 'shortanswer' and claims):
        try:
            if Fraction(q['answer']) != arithmetic(claims[0]['expression']):
                errors.append('numerical_response_mismatch')
        except (ValueError, KeyError, TypeError, SyntaxError, ZeroDivisionError):
            errors.append('numerical_response_unparseable')
    # Legacy determinant prompts have a fully parseable mathematical meaning.
    match = re.search(r'det\(\[\[(-?\d+),\s*(-?\d+)\],\[(-?\d+),\s*(-?\d+)\]\]\)', str(q.get('prompt', '')))
    if match:
        a, b, c, d = map(int, match.groups())
        try:
            if Fraction(q['answer']) != a*d-b*c: errors.append('determinant_answer_incorrect')
        except (ValueError, KeyError): errors.append('determinant_answer_unparseable')
    text = normalize(q.get('prompt', ''))
    match = re.search(r'integral of \((\d+)x\+(\d+)\) from x=(-?\d+) to x=(-?\d+)', text)
    if match:
        a, b, lo, hi = map(int, match.groups())
        expected = Fraction(a, 2)*(hi*hi-lo*lo)+b*(hi-lo)
        try:
            if Fraction(q['answer']) != expected: errors.append('integral_answer_incorrect')
        except (ValueError, KeyError): errors.append('integral_answer_unparseable')
    match = re.search(r'derivative at x=(-?\d+) of y=(\d+)x³-(\d+)x²\+(\d+)x\+(\d+)', text)
    if match:
        x, a, b, c, _ = map(int, match.groups())
        try:
            if Fraction(q['answer']) != 3*a*x*x-2*b*x+c: errors.append('derivative_answer_incorrect')
        except (ValueError, KeyError): errors.append('derivative_answer_unparseable')
    return sorted(set(errors))


def load_questions(root=ROOT):
    records, files, issues = [], [], []
    for path in sorted(root.glob('original-*.json')):
        try:
            data = json.loads(path.read_text())
            questions = data['questions']
            if not isinstance(questions, list): raise ValueError('questions must be an array')
            if type(data.get('schemaVersion')) is not int or data['schemaVersion'] not in (1, 2):
                raise ValueError('unsupported schemaVersion')
        except (ValueError, KeyError, TypeError) as exc:
            issues.append({'file': path.name, 'error': str(exc)})
            continue
        files.append({'path': path.name, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                      'declared': data.get('questionCount'), 'actual': len(questions)})
        if data.get('questionCount') != len(questions):
            issues.append({'file': path.name, 'error': 'declared_count_mismatch'})
        for index, q in enumerate(questions):
            if isinstance(q, dict): records.append({'file': path.name, 'index': index, 'q': q})
            else: issues.append({'file': path.name, 'index': index, 'error': 'question_not_object'})
    return records, files, issues


def duplicate_groups(records, numeric=False):
    groups = collections.defaultdict(list)
    for i, r in enumerate(records): groups[signature(r['q'], numeric)].append(i)
    return [v for v in groups.values() if len(v) > 1]


def near_pairs(records):
    """Token Jaccard >= .86 within a subject; prompts include passage evidence.

    Lexical candidates only: absence of a flag is not proof of conceptual novelty.
    """
    index, sets, pairs = collections.defaultdict(set), [], []
    for i, r in enumerate(records):
        q = r['q']; tokens = set(re.findall(r'\w+|[+*/=<>-]', signature({'prompt': q.get('prompt', '')})))
        sets.append(tokens)
        if len(tokens) < 8: continue
        subject = canonical_subject(q.get('exam'), q.get('subject', ''))
        if subject in {'English Language', 'Use of English', 'English Studies', 'Reading and Writing', 'Reading'}:
            subject = 'English language skills'
        candidates = set().union(*(index[(subject, t)] for t in tokens))
        for j in sorted(candidates):
            # Shared passage wording is evidence, not a repeated assessed skill.
            # Generic task wording on different passages is not itself a duplicate.
            other_q = records[j]['q']
            if (normalize(q.get('prompt', '')) == normalize(other_q.get('prompt', ''))
                    and q.get('passage') and other_q.get('passage')
                    and q['passage'] != other_q['passage']): continue
            other = sets[j]
            if min(len(tokens), len(other)) / max(len(tokens), len(other)) < .86: continue
            similarity = len(tokens & other) / len(tokens | other)
            if similarity >= .86 and signature(q) != signature(records[j]['q']):
                pairs.append((j, i, round(similarity, 4)))
        for t in tokens: index[(subject, t)].add(i)
    return pairs


def audit(root=ROOT):
    specs = json.loads((root/'specifications/registry.json').read_text())
    objectives = {o['id']: o for o in specs['objectives']}
    if len(objectives) != len(specs['objectives']): raise ValueError('duplicate objective IDs')
    records, files, file_issues = load_questions(root)
    errors = [check_question(r['q'], objectives) for r in records]
    ids = collections.defaultdict(list)
    for i, r in enumerate(records): ids[r['q'].get('id')].append(i)
    for group in ids.values():
        if len(group) > 1:
            for i in group: errors[i].append('duplicate_id')
    exact, numeric, near = duplicate_groups(records), duplicate_groups(records, True), near_pairs(records)
    for groups, code in [(exact, 'identical_prompt_hold'), (numeric, 'numeric_template_hold')]:
        for group in groups:
            for i in group: errors[i].append(code)
    for a, b, _ in near:
        errors[a].append('near_duplicate_hold'); errors[b].append('near_duplicate_hold')
    rows = {}
    def key(exam, subject, level=''):
        return (exam, canonical_subject(exam, subject), level if exam == 'NERDC' else '')
    for entry in specs['banks']:
        k = key(entry['exam'], entry['subject'], entry.get('level', ''))
        rows[k] = {**entry, 'subject': k[1], 'raw': 0, 'validDrafts': 0, 'reviewed': 0,
                   'questionTypes': collections.Counter(), 'difficulty': collections.Counter()}
    for i, record in enumerate(records):
        q = record['q']; k = key(q.get('exam', ''), q.get('subject', ''), q.get('level', ''))
        if k not in rows:
            rows[k] = {'exam': k[0], 'subject': k[1], 'level': k[2], 'target': 1000,
                       'scopeStatus': 'observed_only_specification_unresolved', 'raw': 0,
                       'validDrafts': 0, 'reviewed': 0, 'questionTypes': collections.Counter(),
                       'difficulty': collections.Counter()}
        row = rows[k]; row['raw'] += 1
        row['questionTypes'][q.get('type', 'missing')] += 1
        row['difficulty'][q.get('difficulty', 'missing')] += 1
        if not errors[i]: row['validDrafts'] += 1
    coverage = []
    for oid, obj in objectives.items():
        matched = [i for i, r in enumerate(records) if r['q'].get('objectiveId') == oid]
        valid = [i for i in matched if not errors[i]]
        coverage.append({**obj, 'questionCount': len(matched), 'validDrafts': len(valid),
                         'questionTypes': dict(collections.Counter(records[i]['q']['type'] for i in matched)),
                         'difficulty': dict(collections.Counter(records[i]['q'].get('difficulty', 'missing') for i in matched)),
                         'coverageStatus': 'represented_not_complete' if valid else 'missing',
                         'validationStatus': 'automated_checks_pass' if valid else 'no_valid_drafts',
                         'academicReviewStatus': 'pending'})
    for k, row in sorted(rows.items()):
        row['remaining'] = max(0, row['target']-row['validDrafts']) if row.get('target') else None
        objectives_here = [c for c in coverage if key(c['exam'], c['subject'], c.get('level', '')) == k]
        row['mappedObjectives'] = len(objectives_here)
        row['representedObjectives'] = sum(bool(c['validDrafts']) for c in objectives_here)
        row['coverage'] = 'partial_objective_register' if objectives_here else 'specification_unresolved'
        row['completionStatus'] = 'in_progress' if row['validDrafts'] else 'blocked_or_unmapped'
    report = {
        'schemaVersion': 1, 'baselineCommit': specs['baselineCommit'],
        'scopeComplete': False, 'academicReviewComplete': False,
        'countDefinition': 'Conservative automated draft candidates; not verified academic correctness. Every similarity group held. No runtime-generated entries counted.',
        'totals': {'raw': len(records), 'validDrafts': sum(not e for e in errors), 'reviewed': 0,
                   'registeredBanks': len(rows), 'target': sum(r.get('target') or 0 for r in rows.values()),
                   'identicalPromptGroups': len(exact), 'numericTemplateGroups': len(numeric),
                   'nearDuplicatePairs': len(near)},
        'files': files, 'fileIssues': file_issues, 'banks': [rows[k] for k in sorted(rows)],
        'errorCounts': dict(collections.Counter(e for es in errors for e in set(es))),
        'mathematicalVerification': {
            'explicitArithmeticClaims': sum(len(r['q'].get('verification', [])) for r in records
                                           if isinstance(r['q'].get('verification', []), list)),
            'scope': 'Exact arithmetic claims plus parseable legacy determinants, linear definite integrals and selected cubic derivatives. Not all word problems or solutions can be machine verified.',
            'failureCount': sum(any(e in {'arithmetic_claim_incorrect', 'arithmetic_answer_mismatch',
                                         'determinant_answer_incorrect', 'integral_answer_incorrect',
                                         'derivative_answer_incorrect'} for e in es) for es in errors)},
        'questions': [{'id': r['q'].get('id'), 'file': r['file'], 'index': r['index'],
                       'errors': sorted(set(errors[i]))} for i, r in enumerate(records)],
        'identicalPromptGroups': [[records[i]['q'].get('id') for i in g] for g in exact],
        'numericTemplateGroups': [[records[i]['q'].get('id') for i in g] for g in numeric],
        'nearDuplicatePairs': [{'left': records[a]['q'].get('id'), 'right': records[b]['q'].get('id'),
                                'similarity': score} for a, b, score in near],
        'coverage': coverage, 'scopeGaps': specs['scopeGaps'],
    }
    return report


def write_reports(report, root=ROOT):
    out = root/'audits'; out.mkdir(exist_ok=True)
    (out/'completion-dashboard.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
    columns = ['exam', 'subject', 'level', 'target', 'raw', 'validDrafts', 'reviewed', 'remaining',
               'mappedObjectives', 'representedObjectives', 'coverage', 'scopeStatus']
    with (out/'completion-dashboard.csv').open('w') as f:
        writer = csv.DictWriter(f, fieldnames=columns, extrasaction='ignore', lineterminator='\n'); writer.writeheader()
        writer.writerows(report['banks'])
    with (out/'syllabus-coverage.csv').open('w') as f:
        columns = ['id', 'exam', 'subject', 'topic', 'subtopic', 'learningObjective', 'specificationId',
                   'questionCount', 'validDrafts', 'questionTypes', 'difficulty', 'coverageStatus',
                   'validationStatus', 'academicReviewStatus']
        writer = csv.DictWriter(f, fieldnames=columns, extrasaction='ignore', lineterminator='\n'); writer.writeheader()
        writer.writerows(report['coverage'])
    lines = ['# Ndovera complete question-bank dashboard', '',
             'Generated by `python question-data/tools/audit.py --write`. Counts are read from files.', '',
             '**Project incomplete. All questions remain drafts. Scope and objective registers are incomplete.**', '',
             'Validated drafts pass automated checks and conservative similarity holds. This is not academic approval.', '',
             '| Examination | Subject / class | Target | Raw | Valid drafts | Reviewed | Remaining | Coverage |',
             '|---|---|---:|---:|---:|---:|---:|---|']
    for r in report['banks']:
        subject = r['subject'] + (' / '+r['level'] if r.get('level') else '')
        lines.append(f"| {r['exam']} | {subject} | {r.get('target') or 'TBD'} | {r['raw']} | {r['validDrafts']} | {r['reviewed']} | {r['remaining'] if r['remaining'] is not None else 'TBD'} | {r['coverage']} |")
    lines += ['', '## Totals by examination', '', '| Examination | Raw | Valid drafts | Reviewed | Registered target | Remaining |', '|---|---:|---:|---:|---:|---:|']
    for exam in sorted({r['exam'] for r in report['banks']}):
        rs = [r for r in report['banks'] if r['exam'] == exam]
        values = [sum(r.get(k) or 0 for r in rs) for k in ('raw', 'validDrafts', 'reviewed', 'target', 'remaining')]
        lines.append('| '+exam+' | '+' | '.join(map(str, values))+' |')
    lines += ['', 'Overall: '+json.dumps(report['totals']), '',
              'Targets are provisional for registered banks only; unresolved scope is not a zero-sized requirement.', '',
              '## Scope gaps', ''] + ['- '+gap for gap in report['scopeGaps']]
    (out/'completion-dashboard.md').write_text('\n'.join(lines)+'\n')


def main():
    parser = argparse.ArgumentParser(); parser.add_argument('--write', action='store_true')
    parser.add_argument('--strict-new', action='store_true', help='fail for v2 batches, report legacy holds separately')
    parser.add_argument('--strict-all', action='store_true')
    args = parser.parse_args(); report = audit()
    if args.write: write_reports(report)
    new_files = {f.name for f in ROOT.glob('original-*.json') if json.loads(f.read_text()).get('schemaVersion') == 2}
    failures = [q for q in report['questions'] if q['errors'] and (args.strict_all or q['file'] in new_files)]
    print(json.dumps({'totals': report['totals'], 'fileIssues': report['fileIssues'],
                      'failingNewOrSelectedQuestions': failures}, indent=2))
    if report['fileIssues'] or ((args.strict_new or args.strict_all) and failures): raise SystemExit(1)


if __name__ == '__main__': main()
