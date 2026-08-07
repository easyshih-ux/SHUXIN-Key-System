import type { Chapter } from './types'

export const chapters: Chapter[] = [
  { id: 'Chapter 01', number: 1, keyword: '肖像畫', location: '2F中央走廊 A', answer: 'TEACHER', answerType: 'en' },
  { id: 'Chapter 02', number: 2, keyword: '萬花筒', location: '2F中央走廊 B', answer: '0423', answerType: 'number' },
  { id: 'Chapter 03', number: 3, keyword: '老師剪影', location: '1F中央走廊 A', answer: '生教組長', answerType: 'zh' },
  { id: 'Chapter 04', number: 4, keyword: '放大鏡', location: '2F中央走廊 C', answer: 'YSJH', answerType: 'en' },
  { id: 'Chapter 05', number: 5, keyword: '麥克風', location: '總務處外', answer: '0815', answerType: 'number' },
  { id: 'Chapter 06', number: 6, keyword: '名片', location: '教務處外', answer: '教務處在二樓', answerType: 'zh' },
  { id: 'Chapter 07', number: 7, keyword: '校徽', location: '學務處外', answer: 'SCHOOL', answerType: 'en' },
  { id: 'Chapter 08', number: 8, keyword: '座標', location: '1F中央走廊 B', answer: '學校真好玩', answerType: 'zh' },
  { id: 'Chapter 09', number: 9, keyword: '扉頁', location: '2F中央走廊 D（圖書館前）', answer: '16647', answerType: 'number' },
  { id: 'Chapter 10', number: 10, keyword: '索書號', location: '圖書館入口外', answer: 'LIBRARY', answerType: 'en' },
  { id: 'Chapter 11', number: 11, keyword: '頭條', location: '演藝廳入口', answer: '書馨跑關燒腦累積合作力', answerType: 'zh' },
  { id: 'Chapter 12', number: 12, keyword: '守門人', location: '1F中央走廊 C', answer: 'KEY', answerType: 'en' },
  { id: 'Chapter 13', number: 13, keyword: '濾鏡', location: '2F中央走廊 E（教務處旁）', answer: 'TRUTH', answerType: 'en' },
  { id: 'Chapter 14', number: 14, keyword: '羅盤', location: '2F中央走廊 F', answer: '明辨方向', answerType: 'zh' },
  { id: 'Chapter 15', number: 15, keyword: '齒輪', location: '2F中央走廊 G（樓梯口）', answer: '合作', answerType: 'zh' },
  { id: 'Chapter 16', number: 16, keyword: '方向盤', location: '維修室旁', answer: '5206', answerType: 'number' },
  { id: 'Chapter 17', number: 17, keyword: '充電站', location: '健康中心外', answer: '能量補給', answerType: 'zh' },
  { id: 'Chapter 18', number: 18, keyword: '校園地圖', location: '2F中央走廊 H（中央位置）', answer: '267', answerType: 'number' },
  { id: 'Chapter 19', number: 19, keyword: '鑰匙', location: '合作社旁', answer: 'mission', answerType: 'en' },
  { id: 'Chapter 20', number: 20, keyword: '點子燈泡', location: '學務處前庭', answer: 'IDEA', answerType: 'en' },
]

export const chapterById = Object.fromEntries(chapters.map((chapter) => [chapter.id, chapter]))
