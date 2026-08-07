import type { Ability } from './types'

export const abilities: Ability[] = [
  { chapterId: 'Chapter 01', name: '同理觀察力', description: '仔細觀察他人的特徵與感受，學會理解與關心身邊的人。' },
  { chapterId: 'Chapter 02', name: '多元視角力', description: '嘗試換個角度觀看，理解同一件事可能有不同答案。' },
  { chapterId: 'Chapter 03', name: '特徵辨識力', description: '從人物、情境與物件的特徵中，辨認重要線索。' },
  { chapterId: 'Chapter 04', name: '細節洞察力', description: '放慢速度、仔細比較，發現容易被忽略的細節。' },
  { chapterId: 'Chapter 05', name: '自信表達力', description: '勇敢而清楚地說出自己的想法，讓別人理解自己。' },
  { chapterId: 'Chapter 06', name: '自我認識力', description: '認識自己的特質，並用簡潔的方式介紹自己。' },
  { chapterId: 'Chapter 07', name: '校園認同力', description: '認識學校的特色與精神，建立對校園的歸屬感。' },
  { chapterId: 'Chapter 08', name: '自我定位力', description: '找到自己在校園、團體與學習中的位置。' },
  { chapterId: 'Chapter 09', name: '閱讀導航力', description: '從書名、作者、目錄等資訊，找到進入一本書的方法。' },
  { chapterId: 'Chapter 10', name: '資訊檢索力', description: '運用分類、編號與線索，快速找到需要的書籍與資訊。' },
  { chapterId: 'Chapter 11', name: '重點判讀力', description: '從大量內容中判斷主題，找出真正重要的訊息。' },
  { chapterId: 'Chapter 12', name: '資訊查證力', description: '不急著相信眼前訊息，主動查證來源與真實性。' },
  { chapterId: 'Chapter 13', name: '媒體識讀力', description: '看見資訊背後的立場、包裝與可能存在的偏見。' },
  { chapterId: 'Chapter 14', name: '目標定向力', description: '先確定想抵達的目標，再選擇適合的前進方向。' },
  { chapterId: 'Chapter 15', name: '協作整合力', description: '整合每個人的想法與長處，合作創造更好的結果。' },
  { chapterId: 'Chapter 16', name: '主動選擇力', description: '主動做出選擇，採取行動，並為自己的決定負責。' },
  { chapterId: 'Chapter 17', name: '自我更新力', description: '適時休息、整理與調整自己，補充繼續前進的能量。' },
  { chapterId: 'Chapter 18', name: '空間探索力', description: '運用地標、方位與路線，認識並探索所在的環境。' },
  { chapterId: 'Chapter 19', name: '理解開展力', description: '透過閱讀、觀察與思考，打開新的理解與可能。' },
  { chapterId: 'Chapter 20', name: '創意生成力', description: '將閱讀與思考轉化成自己的觀點、點子與作品。' },
]

export const abilityByChapter = Object.fromEntries(abilities.map((ability) => [ability.chapterId, ability]))
