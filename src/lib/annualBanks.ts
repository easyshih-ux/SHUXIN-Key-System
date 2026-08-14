import type { Chapter, ChapterId } from '../data/types'

export interface AnnualChapter extends Chapter {
  acceptedAnswers: string[]
  imageFile: string
}

export interface AnnualBank {
  id: string
  academicYear: string
  name: string
  createdAt: string
  source: 'builtin' | 'imported'
  chapters: AnnualChapter[]
}

export interface BankStore {
  version: 1
  activeBankId: string
  previousActiveBankId: string | null
  banks: AnnualBank[]
}

export interface BankDifference {
  chapterId: ChapterId
  fields: string[]
}

export interface PreparedAnnualBank {
  bank: AnnualBank
  images: Record<string, Blob>
  differences: BankDifference[]
}

export const ANNUAL_BANKS_STORAGE_KEY = 'shuxin-annual-banks-v1'
const IMAGE_DB_NAME = 'shuxin-annual-bank-images-v1'
const IMAGE_STORE = 'images'
export const BUILTIN_BANK_ID = 'builtin-115'
export const CHAPTER_ASSET_VERSION = '20260814-4'

export function createBuiltinBank(chapters: Chapter[], accepted: Partial<Record<ChapterId, string[]>> = {}): AnnualBank {
  return {
    id: BUILTIN_BANK_ID,
    academicYear: '115學年度',
    name: 'SHUXIN 初始年度題庫',
    createdAt: new Date().toISOString(),
    source: 'builtin',
    chapters: chapters.map((chapter) => ({ ...chapter, acceptedAnswers: accepted[chapter.id] ?? [], imageFile: `chapter-${String(chapter.number).padStart(2, '0')}.webp` })),
  }
}

export function loadBankStore(initialBank: AnnualBank): BankStore {
  try {
    const parsed = JSON.parse(localStorage.getItem(ANNUAL_BANKS_STORAGE_KEY) ?? '') as BankStore
    if (parsed?.version === 1 && parsed.banks?.length && parsed.banks.some((bank) => bank.id === parsed.activeBankId)) {
      const banks = parsed.banks.map((bank) => bank.id === BUILTIN_BANK_ID
        ? { ...bank, chapters: bank.chapters.map((chapter) => ({ ...chapter, imageFile: `chapter-${String(chapter.number).padStart(2, '0')}.webp` })) }
        : bank)
      const migrated = { ...parsed, banks }
      saveBankStore(migrated)
      return migrated
    }
  } catch { /* use initial bank */ }
  const store: BankStore = { version: 1, activeBankId: initialBank.id, previousActiveBankId: null, banks: [initialBank] }
  saveBankStore(store)
  return store
}

export function saveBankStore(store: BankStore) {
  localStorage.setItem(ANNUAL_BANKS_STORAGE_KEY, JSON.stringify(store))
}

export function activeBank(store: BankStore) {
  return store.banks.find((bank) => bank.id === store.activeBankId) ?? store.banks[0]
}

function openImageDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(IMAGE_DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(IMAGE_STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function saveImportedImages(bankId: string, images: Record<string, Blob>) {
  const db = await openImageDb()
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(IMAGE_STORE, 'readwrite')
    const store = transaction.objectStore(IMAGE_STORE)
    Object.entries(images).forEach(([file, blob]) => store.put(blob, `${bankId}/${file}`))
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error)
  })
  db.close()
}

export async function deleteImportedImages(bankId: string) {
  const db = await openImageDb()
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(IMAGE_STORE, 'readwrite')
    const store = transaction.objectStore(IMAGE_STORE)
    const request = store.getAllKeys()
    request.onsuccess = () => request.result.filter((key) => String(key).startsWith(`${bankId}/`)).forEach((key) => store.delete(key))
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
  db.close()
}

async function loadImportedImage(bankId: string, file: string) {
  const db = await openImageDb()
  const blob = await new Promise<Blob | undefined>((resolve, reject) => {
    const request = db.transaction(IMAGE_STORE).objectStore(IMAGE_STORE).get(`${bankId}/${file}`)
    request.onsuccess = () => resolve(request.result as Blob | undefined)
    request.onerror = () => reject(request.error)
  })
  db.close()
  return blob
}

export async function resolveBankImageUrl(bank: AnnualBank, chapterNumber: number) {
  const chapter = bank.chapters.find((item) => item.number === chapterNumber)
  if (!chapter) return ''
  if (bank.source === 'builtin') return `${import.meta.env.BASE_URL}assets/chapters/${chapter.imageFile}?v=${CHAPTER_ASSET_VERSION}`
  const blob = await loadImportedImage(bank.id, chapter.imageFile)
  return blob ? URL.createObjectURL(blob) : ''
}

const normalizeHeader = (value: unknown) => String(value ?? '').trim().toLowerCase().replace(/[\s_-]+/g, '')
const cell = (row: Record<string, unknown>, names: string[]) => {
  const entry = Object.entries(row).find(([key]) => names.includes(normalizeHeader(key)))
  return entry?.[1]
}

function parseRows(rows: Record<string, unknown>[], academicYear: string): AnnualBank {
  if (rows.length !== 20) throw new Error(`題庫資料必須正好20列，目前為${rows.length}列`)
  const chapters = rows.map((row) => {
    const number = Number(cell(row, ['chapter', 'chapternumber', '編號', 'chapter編號']))
    const keyword = String(cell(row, ['keyword', 'name', '關卡名稱', '名稱']) ?? '').trim()
    const answer = String(cell(row, ['answer', '正式答案', '答案']) ?? '').trim().replace(/^'/, '')
    const acceptedRaw = String(cell(row, ['acceptedanswers', '可接受答案']) ?? '').trim()
    const imageFile = String(cell(row, ['image', 'imagefile', '圖片', '圖片檔名']) ?? `chapter-${String(number).padStart(2, '0')}.png`).trim()
    const answerTypeRaw = String(cell(row, ['answertype', '答案類型']) ?? 'zh').toLowerCase()
    if (!Number.isInteger(number) || number < 1 || number > 20 || !keyword || !answer) throw new Error('每列必須包含有效的Chapter、關卡名稱與正式答案')
    return { id: `Chapter ${String(number).padStart(2, '0')}` as ChapterId, number, keyword, location: '', answer, answerType: ['en', 'number'].includes(answerTypeRaw) ? answerTypeRaw as 'en' | 'number' : 'zh' as const, acceptedAnswers: acceptedRaw ? acceptedRaw.split(/[，,;；|]/).map((item) => item.trim()).filter(Boolean) : [], imageFile }
  })
  if (new Set(chapters.map((chapter) => chapter.number)).size !== 20) throw new Error('Chapter編號重複或缺漏')
  chapters.sort((a, b) => a.number - b.number)
  return { id: `bank-${academicYear.replace(/\W/g, '')}-${Date.now()}`, academicYear, name: `${academicYear} SHUXIN題庫`, createdAt: new Date().toISOString(), source: 'imported', chapters }
}

function compareBanks(current: AnnualBank, next: AnnualBank): BankDifference[] {
  return next.chapters.flatMap((chapter) => {
    const before = current.chapters.find((item) => item.number === chapter.number)
    const fields: string[] = []
    if (!before || before.keyword !== chapter.keyword) fields.push('關卡名稱')
    if (!before || before.answer !== chapter.answer) fields.push('正式答案')
    if (!before || before.acceptedAnswers.join('|') !== chapter.acceptedAnswers.join('|')) fields.push('可接受答案')
    if (!before || before.imageFile !== chapter.imageFile || next.source === 'imported') fields.push('圖片')
    return fields.length ? [{ chapterId: chapter.id, fields }] : []
  })
}

export async function prepareAnnualBankZip(file: File, current: AnnualBank): Promise<PreparedAnnualBank> {
  const [{ default: JSZip }, XLSX] = await Promise.all([import('jszip'), import('xlsx')])
  const zip = await JSZip.loadAsync(file)
  const manifestEntry = zip.file('manifest.json')
  if (!manifestEntry) throw new Error('ZIP缺少 manifest.json')
  const manifest = JSON.parse(await manifestEntry.async('text')) as { academicYear?: string }
  if (!manifest.academicYear?.trim()) throw new Error('manifest.json缺少academicYear')
  const xlsxEntry = zip.file('questions.xlsx')
  const csvEntry = zip.file('questions.csv')
  const sheetEntry = xlsxEntry ?? csvEntry
  if (!sheetEntry) throw new Error('ZIP缺少 questions.xlsx 或 questions.csv')
  const workbook = xlsxEntry
    ? XLSX.read(await xlsxEntry.async('uint8array'), { type: 'array' })
    : XLSX.read(await csvEntry!.async('text'), { type: 'string', codepage: 65001 })
  const worksheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' })
  const bank = parseRows(rows, manifest.academicYear.trim())
  const images: Record<string, Blob> = {}
  for (const chapter of bank.chapters) {
    if (!/^chapter-(0[1-9]|1\d|20)\.(png|jpe?g|webp)$/i.test(chapter.imageFile)) throw new Error(`${chapter.id}圖片檔名不符合規則`)
    const entry = zip.file(`images/${chapter.imageFile}`)
    if (!entry) throw new Error(`缺少 images/${chapter.imageFile}`)
    const extension = chapter.imageFile.split('.').pop()!.toLowerCase()
    const mime = extension === 'png' ? 'image/png' : extension === 'webp' ? 'image/webp' : 'image/jpeg'
    const bytes = await entry.async('uint8array')
    const blob = new Blob([new Uint8Array(bytes).buffer as ArrayBuffer], { type: mime })
    try { const bitmap = await createImageBitmap(blob); bitmap.close() }
    catch { throw new Error(`${chapter.imageFile}不是有效圖片`) }
    images[chapter.imageFile] = blob
  }
  if (Object.keys(images).length !== 20) throw new Error('年度包必須包含20張題目圖片')
  return { bank, images, differences: compareBanks(current, bank) }
}
