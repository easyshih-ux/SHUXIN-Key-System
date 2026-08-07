export type ChapterId = `Chapter ${string}`

export interface Chapter {
  id: ChapterId
  number: number
  keyword: string
  location: string
  answer: string
  answerType: 'zh' | 'en' | 'number'
}

export interface Ability {
  chapterId: ChapterId
  name: string
  description: string
}

export interface Route {
  id: string
  name: string
  chapters: ChapterId[]
}
