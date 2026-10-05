import { Filter } from 'bad-words'

const profanityFilter = new Filter()
const profaneWords = new Set(profanityFilter.list
  .map((word) => word.toLowerCase())
  .filter((word) => !profanityFilter.exclude.includes(word)))
let wordListPromise
let allowedWordsPromise
let allowedWordSet
const wordsByLength = new Map()

function fetchWords(fileName) {
  return fetch(`${import.meta.env.BASE_URL}${fileName}`)
    .then((response) => {
      if (!response.ok) throw new Error(`The ${fileName} word list could not be loaded.`)
      return response.text()
    })
    .then((text) => [...new Set(text
      .split(/\r?\n/)
      .map((word) => word.trim().toLowerCase())
      .filter((word) => /^[a-z]+$/.test(word)))])
}

function loadWordList() {
  if (!wordListPromise) {
    wordListPromise = fetchWords('top_english_words_lower_1000000.txt')
      .then((words) => words.filter((word) => !profaneWords.has(word)))
  }

  return wordListPromise
}

function loadAllowedWordSet() {
  if (!allowedWordsPromise) {
    allowedWordsPromise = Promise.all([
      fetchWords('words_alpha.txt'),
      fetchWords('top_english_words_lower_1000000.txt')
    ]).then(([dictionaryWords, commonWords]) => {
      allowedWordSet = new Set(dictionaryWords)
      for (const word of commonWords) allowedWordSet.add(word)
      return allowedWordSet
    })
  }

  return allowedWordsPromise
}

export async function getWords(length) {
  const words = await loadWordList()
  if (length === undefined) return words
  if (!wordsByLength.has(length)) wordsByLength.set(length, words.filter((word) => word.length === length))
  return wordsByLength.get(length)
}

export async function getRandomWord(length) {
  const words = await getWords(length)
  if (!words.length) throw new Error('No words are available for this game mode.')
  const index = Math.floor(Math.random() ** 2 * words.length)
  return words[index]
}

export async function isAllowedWord(word) {
  const words = await loadAllowedWordSet()
  return words.has(word.toLowerCase())
}
