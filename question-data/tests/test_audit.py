import copy
import importlib.util
import unittest
import json
import tempfile
from pathlib import Path

spec = importlib.util.spec_from_file_location('audit', Path(__file__).parents[1]/'tools/audit.py')
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


class ValidationTests(unittest.TestCase):
    def setUp(self):
        self.obj = {'id': 'o1', 'exam': 'JAMB', 'subject': 'Economics',
                    'topic': 'Costs', 'subtopic': 'Average cost',
                    'learningObjective': 'Calculate average cost.', 'specificationId': 's1',
                    'questionTypes': ['mcq', 'structured']}
        self.q = {k: v for k, v in self.obj.items() if k not in {'id', 'questionTypes'}}
        self.q.update(id='q1', objectiveId='o1', examType='original-practice',
                      curriculum='exam-style', level='UTME', type='mcq',
                      prompt='Total cost is 50 for 10 units. Find average cost.',
                      options=['2', '5', '10', '50'], answer='5', correctOption='B',
                      explanation='Average cost is 50/10 = 5.', score=1, difficulty='standard',
                      cognitiveDemand='apply', status='draft', source='original',
                      license='original-content', academicReview={'status': 'pending', 'reviewer': None},
                      verification=[{'expression': '50/10', 'expected': '5', 'answerValue': '5', 'purpose': 'Average cost'}])

    def errors(self): return audit.check_question(self.q, {'o1': self.obj})
    def test_valid(self): self.assertEqual(self.errors(), [])
    def test_wrong_answer_reference(self):
        self.q['correctOption'] = 'A'; self.assertIn('answer_option_mismatch', self.errors())
    def test_duplicate_options(self):
        self.q['options'][0] = '5'; self.assertIn('duplicate_options', self.errors())
    def test_genotype_case_is_meaningful(self):
        self.q.update(options=['TTT', 'Tt', 'TT', 'tt'], answer='Tt', correctOption='B')
        self.assertNotIn('duplicate_options', self.errors())
    def test_legacy_guide_compared_to_max_marks(self):
        self.q.pop('score')
        self.q.update(type='structured', maxMarks=4, markingGuide=[{'description': 'Valid criteria', 'marks': 4}])
        self.assertNotIn('marking_total_mismatch', self.errors())
    def test_four_options_required(self):
        self.q['options'].pop(); self.assertIn('mcq_requires_four_text_options', self.errors())
    def test_unknown_objective(self):
        self.q['objectiveId'] = 'missing'; self.assertIn('objective_mapping_missing', self.errors())
    def test_cross_subject_mapping(self):
        self.q['subject'] = 'Biology'; self.assertIn('mapping_mismatch:subject', self.errors())
    def test_bad_arithmetic(self):
        self.q['verification'][0]['expected'] = '6'; self.assertIn('arithmetic_claim_incorrect', self.errors())
    def test_no_code_execution(self):
        with self.assertRaises(ValueError): audit.arithmetic('__import__("os").getcwd()')
    def test_no_unbounded_power(self):
        with self.assertRaises(ValueError): audit.arithmetic('2**1000000')
    def test_exact_fraction(self): self.assertEqual(audit.arithmetic('1/3+2/3'), 1)
    def test_review_gate(self):
        self.q['status'] = 'approved'; self.assertIn('review_gate:must_remain_draft', self.errors())
    def test_marking_sum(self):
        self.q.update(exam='WAEC', type='structured', maxMarks=4, score=4,
                      markingGuide=[{'description': 'Method', 'marks': 2}])
        self.assertIn('marking_total_mismatch', self.errors())
    def test_missing_legacy_marks(self):
        self.q.update(type='structured', markingGuide=[{'description': 'Method'}])
        self.assertIn('marking_guide_requires_positive_marks_and_criteria', self.errors())
    def test_unresolved_class(self):
        self.q.update(exam='NERDC', level='Primary'); self.assertIn('class_assignment_unresolved', self.errors())
    def test_math_operators_remain_distinct(self):
        self.assertNotEqual(audit.signature({'prompt': 'Solve x+2=5'}), audit.signature({'prompt': 'Solve x-2=5'}))
    def test_template_and_cross_exam_duplicates(self):
        records = [{'q': {'prompt': 'For WAEC, solve 2x+3=9.'}},
                   {'q': {'prompt': 'For JAMB, solve 3x+4=7.'}}]
        self.assertEqual(audit.duplicate_groups(records, True), [[0, 1]])
    def test_passage_is_part_of_identity(self):
        self.assertNotEqual(audit.signature({'prompt': 'What is the main point?', 'passage': 'A'}),
                            audit.signature({'prompt': 'What is the main point?', 'passage': 'B'}))
    def test_legacy_determinant_error(self):
        self.q.update(prompt='For WAEC, calculate det([[2,3],[4,4]]).', answer='4')
        self.assertIn('determinant_answer_incorrect', self.errors())
    def test_legacy_integral_error(self):
        self.q.update(prompt='For WAEC, evaluate the integral of (4x+3) from x=0 to x=2.', answer='10')
        self.assertIn('integral_answer_incorrect', self.errors())
    def test_invalid_field_types_are_reported(self):
        self.q.update(prompt=None, objectiveId=[], verification='not-an-array')
        errors = self.errors()
        self.assertIn('missing_or_invalid:prompt', errors)
        self.assertIn('objective_mapping_missing', errors)
        self.assertIn('verification_must_be_array', errors)
    def test_nonfinite_score_rejected(self):
        self.q['score'] = float('nan'); self.assertIn('invalid_score', self.errors())
    def test_pipeline_holds_duplicate_ids(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder); (root/'specifications').mkdir()
            registry = {'baselineCommit': 'test', 'objectives': [self.obj], 'banks': [], 'scopeGaps': []}
            (root/'specifications/registry.json').write_text(json.dumps(registry))
            second = copy.deepcopy(self.q); second['prompt'] = 'A distinct prompt with the same ID.'
            (root/'original-test.json').write_text(json.dumps({'schemaVersion': 2,
                'questionCount': 2, 'questions': [self.q, second]}))
            report = audit.audit(root)
            self.assertEqual(report['totals']['raw'], 2)
            self.assertEqual(report['totals']['validDrafts'], 0)
            self.assertTrue(all('duplicate_id' in q['errors'] for q in report['questions']))
    def test_declared_count_mismatch(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root/'original-test.json').write_text(json.dumps({'schemaVersion': 2, 'questionCount': 1000, 'questions': [self.q]}))
            records, files, issues = audit.load_questions(root)
            self.assertEqual(len(records), 1)
            self.assertEqual(issues[0]['error'], 'declared_count_mismatch')
    def test_shared_stimulus_is_not_a_near_duplicate(self):
        long_passage = 'A shared stimulus with many repeated words. '*50
        records = [{'q': {'subject': 'English', 'prompt': 'Which claim follows from the data?', 'passage': long_passage}},
                   {'q': {'subject': 'English', 'prompt': 'What does the word provisional mean?', 'passage': long_passage}}]
        self.assertEqual(audit.near_pairs(records), [])
    def test_short_model_answer_is_held(self):
        self.q.update(minimumResponseWords=150, modelAnswerWordCount=1)
        self.assertIn('model_answer_below_required_word_count', self.errors())
    def test_spoken_task_needs_performance(self):
        self.q['responseMode'] = 'spoken'
        self.assertIn('spoken_response_requires_performance_evidence', self.errors())
    def test_sat_numeric_answer_is_checked(self):
        self.q.update(exam='SAT', subject='Mathematics', type='shortanswer', answer='9')
        self.assertIn('numerical_response_mismatch', self.errors())
    def igcse_fixture(self):
        self.obj.update(exam='IGCSE', qualificationCode='0620', syllabusVersion='2',
                        examinationYears=[2026, 2027, 2028], tiers=['Core', 'Extended'])
        self.q.update(exam='IGCSE', qualificationCode='0620', syllabusVersion='2',
                      examinationYear=2026, tier='Extended', assessmentObjectives=['AO2'],
                      practiceComponent='multiple-choice')
    def test_igcse_qualified_item(self):
        self.igcse_fixture(); self.assertEqual(self.errors(), [])
    def test_igcse_wrong_qualification(self):
        self.igcse_fixture(); self.q['qualificationCode'] = '0971'
        self.assertIn('igcse_mapping_mismatch:qualificationCode', self.errors())
    def test_igcse_expired_year(self):
        self.igcse_fixture(); self.q['examinationYear'] = 2029
        self.assertIn('igcse_examination_year_unmapped', self.errors())
    def test_igcse_unknown_tier(self):
        self.igcse_fixture(); self.q['tier'] = 'Foundation'
        self.assertIn('igcse_tier_unmapped', self.errors())
    def test_igcse_practical_cannot_be_mcq(self):
        self.igcse_fixture(); self.q['assessmentObjectives'] = ['AO3']
        self.assertIn('igcse_practical_component_mismatch', self.errors())
    def test_igcse_aos_are_required(self):
        self.igcse_fixture(); self.q.pop('assessmentObjectives')
        self.assertIn('igcse_assessment_objective_missing_or_invalid', self.errors())


if __name__ == '__main__': unittest.main()
