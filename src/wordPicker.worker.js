import { Filter } from 'bad-words'

const profanityFilter = new Filter()
const profaneWords = new Set(profanityFilter.list
  .map((word) => word.toLowerCase())
  .filter((word) => !profanityFilter.exclude.includes(word)))
const wordFiles = new Map()
const wordsByLength = new Map()
const revivalWordsByLength = new Map()
let answerWordsPromise
let allowedWordsPromise
let revivalWordsPromise

function fetchWords(fileName) {
  if (!wordFiles.has(fileName)) {
    wordFiles.set(fileName, fetch(`${import.meta.env.BASE_URL}${fileName}`)
      .then((response) => {
        if (!response.ok) throw new Error(`The ${fileName} word list could not be loaded.`)
        return response.text()
      })
      .then((text) => [...new Set(text
        .split(/\r?\n/)
        .map((word) => word.trim().toLowerCase())
        .filter((word) => /^[a-z]+$/.test(word)))])
      .catch((error) => {
        wordFiles.delete(fileName)
        throw error
      }))
  }
  return wordFiles.get(fileName)
}

function loadAnswerWords() {
  if (!answerWordsPromise) {
    answerWordsPromise = fetchWords('top_english_words_lower_1000000.txt')
      .then((words) => words.filter((word) => !profaneWords.has(word)))
  }
  return answerWordsPromise
}

function loadAllowedWords() {
  if (!allowedWordsPromise) {
    allowedWordsPromise = Promise.all([
      fetchWords('words_alpha.txt'),
      fetchWords('top_english_words_lower_1000000.txt')
    ]).then(([dictionaryWords, commonWords]) => new Set([...dictionaryWords, ...commonWords]))
  }
  return allowedWordsPromise
}

function loadRevivalWords() {
  if (!revivalWordsPromise) revivalWordsPromise = fetchWords('google-10000-english-usa-no-swears.txt')
  return revivalWordsPromise
}

async function getWords(length) {
  const words = await loadAnswerWords()
  if (length === undefined) return words
  if (!wordsByLength.has(length)) wordsByLength.set(length, words.filter((word) => word.length === length))
  return wordsByLength.get(length)
}

async function getRandomWord(length) {
  const words = await getWords(length)
  if (!words.length) throw new Error('No words are available for this game mode.')
  return words[Math.floor(Math.random() ** 2 * words.length)]
}

async function getDailyWord(length, timestamp) {
  const words = await getWords(length)
  if (!words.length) throw new Error('No words are available for this game mode.')
  const date = new Date(timestamp)
  const dateKey = `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}-${date.getUTCDate()}`
  let hash = 2166136261
  for (const character of `${dateKey}:${length}`) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619)
  const position = (hash >>> 0) / 0x100000000
  return words[Math.floor(position ** 2 * words.length)]
}

async function getRandomRevivalWord(length) {
  const words = await loadRevivalWords()
  if (!revivalWordsByLength.has(length)) revivalWordsByLength.set(length, words.filter((word) => word.length === length))
  const matchingWords = revivalWordsByLength.get(length)
  if (!matchingWords.length) throw new Error('No words are available for the revival game.')
  return matchingWords[Math.floor(Math.random() * matchingWords.length)]
}

async function handleRequest(action, data) {
  if (action === 'getWords') return getWords(data.length)
  if (action === 'getRandomWord') return getRandomWord(data.length)
  if (action === 'getDailyWord') return getDailyWord(data.length, data.date)
  if (action === 'getRandomRevivalWord') return getRandomRevivalWord(data.length)
  if (action === 'isAllowedWord') {
    const words = await loadAllowedWords()
    return words.has(data.word.toLowerCase())
  }
  throw new Error('Unknown word picker request.')
}

self.addEventListener('message', async (event) => {
  const { id, action, ...data } = event.data
  if (action !== 'isAllowedWord') loadAllowedWords().catch(() => {})
  try {
    const result = await handleRequest(action, data)
    self.postMessage({ id, result })
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : 'The word list could not be loaded.' })
  }
})
