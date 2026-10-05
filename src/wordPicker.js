const pickerWorker = new Worker(new URL('./wordPicker.worker.js', import.meta.url), { type: 'module' })
const pendingRequests = new Map()
let nextRequestId = 0

pickerWorker.addEventListener('message', (event) => {
  const { id, result, error } = event.data
  const request = pendingRequests.get(id)
  if (!request) return
  pendingRequests.delete(id)
  if (error) request.reject(new Error(error))
  else request.resolve(result)
})

pickerWorker.addEventListener('error', (event) => {
  for (const request of pendingRequests.values()) request.reject(new Error(event.message || 'The word worker failed.'))
  pendingRequests.clear()
})

function request(action, data = {}) {
  const id = ++nextRequestId
  return new Promise((resolve, reject) => {
    pendingRequests.set(id, { resolve, reject })
    pickerWorker.postMessage({ id, action, ...data })
  })
}

export function getWords(length) {
  return request('getWords', { length })
}

export function getRandomWord(length) {
  return request('getRandomWord', { length })
}

export function getDailyWord(length, date = new Date()) {
  return request('getDailyWord', { length, date: date.getTime() })
}

export function getRandomRevivalWord(length) {
  return request('getRandomRevivalWord', { length })
}

export function isAllowedWord(word) {
  return request('isAllowedWord', { word })
}
