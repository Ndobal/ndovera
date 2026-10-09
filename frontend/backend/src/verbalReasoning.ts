// Verbal Reasoning for Primary 1–6, from a fixed bank written by rule — no AI,
// so every answer is known and it costs nothing.
//
// Ported from the Ndovera Verbal Reasoning Worksheet Studio
// (ndovera_verbal_reasoning_1000/lib/question_bank.dart, word_bank.dart, engine.dart):
// exactly 1,000 items per Primary class — authored vocabulary (opposites, similar
// meanings, odd word out, word relationships), alphabet patterns, letter codes
// and alphabetical order — with topics opening up by class. The classes share
// some items, so the 6,000 class entries are not 6,000 distinct questions.
//
// Used like Quantitative Reasoning (quantReasoning.ts): the assessment generator
// takes questions from this bank for Verbal Reasoning in a Primary class, and
// Ndovera's practice bank is filled with it, a slice per cron run.

import type { AiRunner } from './aiAssessments'
import { levelOf, subjectKeyOf } from './levels'
import { GLOBAL_TENANT, upsertBankQuestions } from './practiceArena'
import type { BankInput } from './practiceArena'
import { requestedSlots, seededRandom } from './quantReasoning'

export type VrTopic = 'alphabet' | 'alphabeticalOrder' | 'opposites' | 'synonyms' | 'oddOneOut' | 'analogies' | 'letterCodes'
export const VR_TOPIC_LABELS: Record<VrTopic, string> = {
  alphabet: 'Alphabet patterns', alphabeticalOrder: 'Alphabetical order', opposites: 'Opposite words',
  synonyms: 'Words with similar meanings', oddOneOut: 'Odd word out', analogies: 'Word relationships', letterCodes: 'Letter codes',
}

/** One bank item. `choices` are the words to choose from; `sequence` is a pattern with one '?'. */
export type VrItem = { id: string, topic: VrTopic, prompt: string, choices: string[], sequence: string[], answer: string, explanation: string }

export function topicsForGrade(grade: number): VrTopic[] {
  return [
    'alphabet', 'alphabeticalOrder', 'opposites', 'oddOneOut',
    ...(grade >= 3 ? ['synonyms' as const, 'analogies' as const] : []),
    ...(grade >= 4 ? ['letterCodes' as const] : []),
  ]
}

/** Is this Verbal Reasoning in a Primary class? Returns the class (1–6) or null. */
export function verbalReasoningGrade(subjectName: unknown, className: unknown) {
  if (subjectKeyOf(subjectName) !== 'verbal-reasoning') return null
  const level = levelOf(className)
  return level && level.section === 'primary' ? level.rank : null
}

// ─── The authored vocabulary (word_bank.dart) ───────────────────────────────

export const EASY_WORDS = ['ant', 'bag', 'cat', 'dog', 'egg', 'fan', 'goat', 'hat', 'ink', 'jam', 'kite',
  'leaf', 'mat', 'nest', 'owl', 'pen', 'queen', 'rat', 'sun', 'top', 'van', 'web', 'yam', 'zoo']
export const ADVANCED_WORDS = ['apple', 'apply', 'basket', 'battle', 'candle', 'canvas', 'branch',
  'bread', 'bright', 'brisk', 'garden', 'garment', 'market', 'marble', 'planet', 'plastic',
  'school', 'science', 'silver', 'simple', 'travel', 'thread', 'window', 'winter']

type WordItem = [topic: VrTopic, prompt: string, choices: string[], answer: string, explanation: string, minGrade: number]
const opposite = (word: string, choices: string[]): WordItem =>
  ['opposites', `Choose the opposite of ${word}.`, choices, choices[0], `${word[0].toUpperCase()}${word.slice(1)} and ${choices[0]} have opposite meanings.`, 1]
const similar = (word: string, choices: string[]): WordItem =>
  ['synonyms', `Choose the word closest in meaning to ${word}.`, choices, choices[0], `In this question, ${word} means ${choices[0]}.`, 3]
const oddOut = (group: string, choices: string[]): WordItem =>
  ['oddOneOut', `Choose the word that does not belong to the named group: ${group}.`, choices, choices[3], `${choices.slice(0, 3).join(', ')} are ${group}; ${choices[3]} is not.`, 1]
const relation = (a: string, b: string, c: string, choices: string[], rule: string): WordItem =>
  ['analogies', `${a} is to ${b} as ${c} is to which word?`, choices, choices[0], `${rule}: ${a} relates to ${b}; ${c} relates to ${choices[0]}.`, 3]

export const WORD_BANK: WordItem[] = [
  opposite('hot', ['cold', 'warm', 'dry']), opposite('big', ['small', 'wide', 'tall']), opposite('up', ['down', 'over', 'near']),
  opposite('open', ['closed', 'wide', 'clear']), opposite('happy', ['sad', 'kind', 'calm']), opposite('fast', ['slow', 'quick', 'early']),
  opposite('day', ['night', 'sun', 'light']), opposite('wet', ['dry', 'cold', 'soft']), opposite('full', ['empty', 'round', 'heavy']),
  opposite('old', ['new', 'large', 'neat']), opposite('long', ['short', 'high', 'deep']), opposite('clean', ['dirty', 'bright', 'clear']),
  opposite('hard', ['soft', 'rough', 'thick']), opposite('near', ['far', 'next', 'close']), opposite('early', ['late', 'soon', 'quick']),
  opposite('strong', ['weak', 'brave', 'firm']), opposite('rich', ['poor', 'kind', 'wise']), opposite('quiet', ['noisy', 'calm', 'gentle']),
  opposite('heavy', ['light', 'large', 'solid']), opposite('inside', ['outside', 'under', 'below']),
  similar('happy', ['glad', 'sad', 'tired']), similar('small', ['little', 'huge', 'wide']), similar('begin', ['start', 'finish', 'pause']),
  similar('finish', ['end', 'start', 'open']), similar('quick', ['fast', 'slow', 'late']), similar('silent', ['quiet', 'loud', 'busy']),
  similar('angry', ['furious', 'calm', 'pleased']), similar('clever', ['smart', 'lazy', 'careless']), similar('large', ['big', 'tiny', 'short']),
  similar('ill', ['sick', 'healthy', 'strong']), similar('pretty', ['beautiful', 'ugly', 'plain']), similar('reply', ['answer', 'question', 'forget']),
  similar('gift', ['present', 'price', 'sale']), similar('brave', ['courageous', 'afraid', 'weak']), similar('simple', ['easy', 'difficult', 'complex']),
  similar('tired', ['weary', 'fresh', 'eager']), similar('correct', ['right', 'wrong', 'broken']), similar('neat', ['tidy', 'messy', 'dirty']),
  similar('assist', ['help', 'hinder', 'ignore']), similar('select', ['choose', 'reject', 'drop']),
  oddOut('fruits', ['mango', 'banana', 'orange', 'chair']), oddOut('animals', ['goat', 'dog', 'cat', 'spoon']),
  oddOut('colours', ['red', 'blue', 'green', 'bread']), oddOut('body parts', ['hand', 'foot', 'ear', 'cup']),
  oddOut('clothes', ['shirt', 'skirt', 'coat', 'stone']), oddOut('vehicles', ['car', 'bus', 'van', 'leaf']),
  oddOut('birds', ['hen', 'duck', 'eagle', 'table']), oddOut('school writing tools', ['pen', 'pencil', 'marker', 'banana']),
  oddOut('days', ['Monday', 'Tuesday', 'Friday', 'January']), oddOut('months', ['March', 'June', 'August', 'Sunday']),
  oddOut('shapes', ['circle', 'square', 'triangle', 'sugar']), oddOut('numbers', ['one', 'two', 'three', 'tree']),
  oddOut('rooms', ['kitchen', 'bedroom', 'bathroom', 'bicycle']), oddOut('furniture', ['chair', 'table', 'bed', 'fish']),
  oddOut('insects', ['ant', 'bee', 'fly', 'goat']), oddOut('drinks', ['water', 'milk', 'juice', 'shoe']),
  oddOut('footwear', ['boot', 'sandal', 'slipper', 'hat']), oddOut('flowers', ['rose', 'lily', 'daisy', 'bus']),
  oddOut('musical instruments', ['drum', 'flute', 'piano', 'plate']), oddOut('eating utensils', ['spoon', 'fork', 'knife', 'sock']),
  relation('bird', 'nest', 'bee', ['hive', 'pond', 'stable'], 'An animal and its home'),
  relation('dog', 'puppy', 'cat', ['kitten', 'calf', 'chick'], 'An animal and its young'),
  relation('cow', 'calf', 'sheep', ['lamb', 'foal', 'cub'], 'An animal and its young'),
  relation('horse', 'foal', 'goat', ['kid', 'puppy', 'chick'], 'An animal and its young'),
  relation('hand', 'glove', 'foot', ['shoe', 'cap', 'belt'], 'A body part and what covers it'),
  relation('eye', 'see', 'ear', ['hear', 'taste', 'smell'], 'A body part and its function'),
  relation('pen', 'write', 'knife', ['cut', 'read', 'sing'], 'A tool and its use'),
  relation('scissors', 'cut', 'broom', ['sweep', 'drink', 'draw'], 'A tool and its use'),
  relation('day', 'night', 'hot', ['cold', 'warm', 'dry'], 'Opposite meanings'),
  relation('big', 'small', 'long', ['short', 'wide', 'heavy'], 'Opposite meanings'),
  relation('happy', 'sad', 'open', ['closed', 'bright', 'neat'], 'Opposite meanings'),
  relation('fish', 'water', 'bird', ['air', 'soil', 'stone'], 'An animal and where it moves'),
  relation('book', 'read', 'song', ['sing', 'cut', 'wash'], 'An item and its usual activity'),
  relation('teacher', 'school', 'doctor', ['hospital', 'farm', 'garage'], 'A worker and workplace'),
  relation('chef', 'kitchen', 'farmer', ['farm', 'airport', 'library'], 'A worker and workplace'),
  relation('pilot', 'aeroplane', 'driver', ['car', 'boat', 'train'], 'A worker and usual vehicle'),
  relation('bee', 'hive', 'hen', ['coop', 'den', 'kennel'], 'An animal and its home'),
  relation('lion', 'cub', 'hen', ['chick', 'kitten', 'lamb'], 'An animal and its young'),
  relation('nose', 'smell', 'tongue', ['taste', 'see', 'hear'], 'A body part and its function'),
  relation('minute', 'time', 'metre', ['length', 'weight', 'temperature'], 'A unit and what it measures'),
]

// ─── The 1,000-item class banks (question_bank.dart) ────────────────────────

export const BANK_SIZE = 1000
const letter = (index: number) => String.fromCharCode(65 + index)
export const encodeWord = (word: string, shift: number) => word.split('').map(char => letter((char.charCodeAt(0) - 65 + shift) % 26)).join('')
const toId = (topic: VrTopic, identity: string) => `vr1:${topic}|${identity}`

const banks = new Map<number, VrItem[]>()

/** Exactly 1,000 items for a Primary class, always the same ones (the id says what the item is). */
export function bankForGrade(grade: number): VrItem[] {
  if (!Number.isInteger(grade) || grade < 1 || grade > 6) throw new Error('Primary class must be 1–6.')
  const cached = banks.get(grade)
  if (cached) return cached
  const items: VrItem[] = []
  const ids = new Set<string>()
  const add = (topic: VrTopic, identity: string, item: Omit<VrItem, 'id' | 'topic'>) => {
    const id = toId(topic, identity)
    if (ids.has(id)) throw new Error(`Duplicate bank item ${id}`)
    ids.add(id)
    items.push({ id, topic, ...item })
  }
  for (const [topic, prompt, choices, answer, explanation, minGrade] of WORD_BANK) {
    if (minGrade <= grade) add(topic, prompt, { prompt, choices, sequence: [], answer, explanation })
  }
  const maxStep = grade <= 2 ? 1 : grade <= 4 ? 2 : 3
  for (let step = 1; step <= maxStep; step += 1) {
    for (let start = 0; start + 4 * step < 26; start += 1) {
      const letters = Array.from({ length: 5 }, (_, index) => letter(start + index * step))
      for (let hole = 0; hole < 5; hole += 1) {
        add('alphabet', `${step}/${start}/${hole}`, {
          prompt: 'Fill the missing letter. Follow the alphabet pattern.', choices: [],
          sequence: letters.map((value, index) => (index === hole ? '?' : value)), answer: letters[hole],
          explanation: `Move forward ${step} letter${step === 1 ? '' : 's'} each time. Complete pattern: ${letters.join(' ')}.`,
        })
      }
    }
  }
  if (grade >= 4) {
    for (let shift = 1; shift <= (grade <= 4 ? 1 : 3); shift += 1) {
      for (const raw of new Set([...EASY_WORDS, ...ADVANCED_WORDS])) {
        const word = raw.toUpperCase()
        // The worked example is CAT, unless CAT is the word asked about.
        const example = word === 'CAT' ? 'DOG' : 'CAT'
        add('letterCodes', `${word}/${shift}`, {
          prompt: `Move each letter forward ${shift} place${shift === 1 ? '' : 's'}. After Z, start again at A. Encode ${word}.`,
          choices: [], sequence: [example, encodeWord(example, shift), word, '?'], answer: encodeWord(word, shift),
          explanation: `${word.split('').map(char => `${char} becomes ${encodeWord(char, shift)}`).join('; ')}.`,
        })
      }
    }
  }
  // Each combination is a different set of words; reordering one is not a new question.
  const words = [...(grade <= 2 ? EASY_WORDS : ADVANCED_WORDS)].sort()
  const size = grade <= 2 ? 3 : 4
  const combinations: string[][] = []
  const enumerate = (start: number, current: string[]) => {
    if (current.length === size) { combinations.push([...current]); return }
    for (let index = start; index <= words.length - (size - current.length); index += 1) {
      current.push(words[index]); enumerate(index + 1, current); current.pop()
    }
  }
  enumerate(0, [])
  shuffle(combinations, seededRandom(20261008 + grade))
  for (const group of combinations) {
    if (items.length === BANK_SIZE) break
    add('alphabeticalOrder', group.join('|'), {
      prompt: 'Which word comes first in alphabetical order?', choices: group, sequence: [], answer: group[0],
      explanation: `Compare letters from left to right. The order is ${group.join(', ')}.`,
    })
  }
  if (items.length !== BANK_SIZE) throw new Error(`Primary ${grade} bank has ${items.length} items, not ${BANK_SIZE}.`)
  banks.set(grade, items)
  return items
}

function shuffle<T>(list: T[], random: () => number) {
  for (let index = list.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1))
    ;[list[index], list[other]] = [list[other], list[index]]
  }
  return list
}

// ─── Showing and marking an item ────────────────────────────────────────────

const cell = (value: string) => (value === '?' ? '**?**' : value)

/**
 * The question as Markdown the app already draws: the pattern as a table, a code
 * as arrows. Words to choose from are listed only when there are no options to
 * show them (a typed answer, or true/false).
 */
export function promptOf(item: VrItem, random?: () => number, listWords = true) {
  if (item.topic === 'alphabet') return `${item.prompt}\n\n| ${item.sequence.map(cell).join(' | ')} |\n|${' --- |'.repeat(item.sequence.length)}`
  if (item.topic === 'letterCodes') {
    const [example, code, word] = item.sequence
    return `${item.prompt}\n\n**${example}** → **${code}**\n\n**${word}** → **?**`
  }
  if (!listWords) return item.prompt
  const words = random ? shuffle([...item.choices], random) : item.choices
  return `${item.prompt}\n\n${words.map(word => `**${word}**`).join(' · ')}`
}

// Extra options must never be a second right answer, so they come from words that cannot fit:
// things (never an opposite or a similar meaning of a describing word), describing words
// (never an animal's young or home, a tool's use, a workplace), and for alphabetical order,
// words that come later than the answer. An odd-word-out group cannot be padded at all.
const THINGS = WORD_BANK.filter(entry => entry[0] === 'oddOneOut').map(entry => entry[3])
const DESCRIBING = WORD_BANK.filter(entry => entry[0] === 'opposites').map(entry => entry[1].replace(/^Choose the opposite of (\w+)\.$/, '$1'))

function safePadding(item: VrItem) {
  const taken = new Set(item.choices.map(word => word.toLowerCase()))
  const free = (words: string[]) => words.filter(word => !taken.has(word.toLowerCase()))
  if (item.topic === 'opposites' || item.topic === 'synonyms') return free(THINGS)
  if (item.topic === 'analogies') return free(DESCRIBING)
  if (item.topic === 'alphabeticalOrder') return free([...EASY_WORDS, ...ADVANCED_WORDS].filter(word => word > item.answer))
  return []
}

/** Wrong answers that look right: the other words offered, nearby letters, or the code with the wrong shift. */
export function vrDistractors(item: VrItem, count: number, random: () => number) {
  let pool: string[]
  if (item.choices.length) {
    pool = item.choices.filter(choice => choice !== item.answer)
    if (pool.length < count) pool.push(...shuffle(safePadding(item), random))
    return pool.slice(0, count)
  }
  if (item.topic === 'alphabet') {
    const at = item.answer.charCodeAt(0) - 65
    pool = [1, -1, 2, -2, 3, -3].map(delta => at + delta).filter(index => index >= 0 && index < 26).map(letter)
  } else {
    const word = item.sequence[2]
    pool = [0, 1, 2, 3, 4, 25].map(shift => encodeWord(word, shift))
  }
  return shuffle(Array.from(new Set(pool)).filter(value => value !== item.answer), random).slice(0, count)
}

// ─── The assessment generator ───────────────────────────────────────────────

/** Map a teacher's topic name to a bank topic (or pick one the class can do). */
export function vrTopicFor(name: string, grade: number, index: number): VrTopic {
  const allowed = topicsForGrade(grade)
  const text = String(name || '').toLowerCase()
  const wanted: VrTopic | null = /alphabetical|dictionary|order/.test(text) ? 'alphabeticalOrder'
    : /code|cipher/.test(text) ? 'letterCodes'
      : /alphabet|letter|missing letter/.test(text) ? 'alphabet'
        : /opposite|antonym/.test(text) ? 'opposites'
          : /synonym|similar|same meaning/.test(text) ? 'synonyms'
            : /odd|belong|classif/.test(text) ? 'oddOneOut'
              : /analog|relation|is to/.test(text) ? 'analogies' : null
  return wanted && allowed.includes(wanted) ? wanted : allowed[index % allowed.length]
}

function pickItem(grade: number, topic: VrTopic, random: () => number, seen: Set<string>) {
  const pool = bankForGrade(grade).filter(item => item.topic === topic && !seen.has(item.id))
  const item = pool.length ? pool[Math.floor(random() * pool.length)] : bankForGrade(grade).find(entry => entry.topic === topic)!
  seen.add(item.id)
  return item
}

function asAssessmentQuestion(slot: { type: string, topic: string, parts: number, optionCount: number }, grade: number, random: () => number, seen: Set<string>, index: number) {
  const { type } = slot
  let item = pickItem(grade, vrTopicFor(slot.topic, grade, index), random, seen)
  if (type === 'mcq') {
    let wrong = vrDistractors(item, slot.optionCount - 1, random)
    // More options than the item can honestly offer: an alphabet pattern can always offer them.
    if (wrong.length < slot.optionCount - 1) {
      item = pickItem(grade, 'alphabet', random, seen)
      wrong = vrDistractors(item, slot.optionCount - 1, random)
    }
    return { type, topic: VR_TOPIC_LABELS[item.topic], prompt: promptOf(item, random, false), options: [item.answer, ...wrong], answerIndex: 0, expectedAnswer: item.answer, workingSteps: [item.explanation], markingPoints: [item.explanation], difficulty: 'standard' }
  }
  const label = VR_TOPIC_LABELS[item.topic]
  if (type === 'truefalse') {
    const honest = random() < 0.5
    const shown = honest ? item.answer : vrDistractors(item, 1, random)[0]
    return { type, topic: label, prompt: `${promptOf(item, random)}\n\nTrue or false: the answer is **${shown}**.`, options: ['True', 'False'], answerIndex: honest ? 0 : 1, expectedAnswer: honest ? 'True' : 'False', workingSteps: [item.explanation], markingPoints: [item.explanation] }
  }
  if (slot.parts > 0) {
    const items = [item, ...Array.from({ length: slot.parts - 1 }, (_, offset) => pickItem(grade, vrTopicFor(slot.topic, grade, index + offset + 1), random, seen))]
    return {
      type, topic: label, prompt: 'Answer each part.',
      parts: items.map(entry => ({ prompt: promptOf(entry, random), marks: 1, expectedAnswer: entry.answer, markingPoints: [entry.explanation] })),
      markingPoints: items.map(entry => entry.explanation),
    }
  }
  return { type, topic: label, prompt: promptOf(item, random), expectedAnswer: item.answer, alternatives: [item.answer], workingSteps: [item.explanation], markingPoints: [item.answer, item.explanation] }
}

/** An AiRunner that answers the assessment engine's request from the bank, exactly as a model would. */
export function verbalReasoningRunner(grade: number): AiRunner {
  return async (messages) => {
    const random = seededRandom((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0)
    const seen = new Set<string>()
    return JSON.stringify(requestedSlots(messages).map((slot, index) => asAssessmentQuestion(slot, grade, random, seen, index)))
  }
}

// ─── Ndovera's practice bank ────────────────────────────────────────────────

const idSeed = (id: string) => Array.from(id).reduce((hash, char) => (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0, 7)

/**
 * A class bank's items as practice questions: words to choose from are multiple
 * choice, patterns and codes are typed (about one in three a choice). An item is
 * laid out the same way whichever class it is seeded for, so an item the classes
 * share is one bank question, kept at the lowest class (Primary 1 is seeded first).
 */
export function vrBankQuestions(grade: number, from = 0, to = BANK_SIZE): BankInput[] {
  return bankForGrade(grade).slice(from, to).map(item => {
    const random = seededRandom(idSeed(item.id))
    const choice = item.choices.length > 0 || idSeed(item.id) % 3 === 0
    return {
      tenantId: GLOBAL_TENANT, type: choice ? 'mcq' : 'shortanswer', prompt: promptOf(item, random, !choice),
      options: choice ? shuffle([item.answer, ...vrDistractors(item, item.choices.length ? item.choices.length - 1 : 3, random)], random) : [],
      answer: choice ? item.answer : [item.answer], explanation: item.explanation,
      subject: 'Verbal Reasoning', section: 'primary', rank: grade, topic: VR_TOPIC_LABELS[item.topic],
      originType: 'ndovera_vr_engine', originId: item.id, answerSource: 'engine',
    }
  })
}

export const VR_SEED_SLICE = 250

/** Fill Ndovera's bank a slice a run (the cron's small budget): 24 runs for all six classes, once per version of the bank. */
export async function seedVerbalReasoningBank(db: D1Database, getState: (key: string) => Promise<string>, setState: (key: string, value: string) => Promise<void>) {
  const key = 'vr-seed:v1'
  const done = Number(await getState(key) || 0)
  const total = 6 * BANK_SIZE
  if (done >= total) return 0
  const grade = Math.floor(done / BANK_SIZE) + 1
  const from = done % BANK_SIZE
  const to = Math.min(BANK_SIZE, from + VR_SEED_SLICE)
  const result = await upsertBankQuestions(db, vrBankQuestions(grade, from, to))
  await setState(key, String((grade - 1) * BANK_SIZE + to))
  return result.added
}
