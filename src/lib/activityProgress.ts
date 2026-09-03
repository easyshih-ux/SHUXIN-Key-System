import { deleteDoc, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import type { ChapterId } from '../data/types'
import type { ProgressState } from './progress'
import { db } from './firebase'
export type PersistedMainView = 'wall' | 'collective' | 'directions' | 'abilities'
export interface ActivityProgressDocument { version: 1; academicYear: string; classId: string; progress: ProgressState; mainView: PersistedMainView; collectiveChapterIds: ChapterId[]; revealStarted: boolean; revealCompleted: boolean; updatedAt: string }
export const normalizeAcademicYearKey = (value: string) => value.trim().replace(/\s+/g, '-').replace(/[/\\.#$\[\]]/g, '-')
export const normalizeClassId = (value: string) => value.trim().replace(/\s+/g, '-').replace(/[/\\.#$\[\]]/g, '-')
export const progressDocumentPath = (year: string, classId: string) => `academicYears/${normalizeAcademicYearKey(year)}/classes/${normalizeClassId(classId)}/activityProgress/current`
export async function loadActivityProgress(year: string, classId: string) { if (!db) return null; const snapshot = await getDoc(doc(db, progressDocumentPath(year, classId))); return snapshot.exists() ? snapshot.data() as ActivityProgressDocument : null }
export async function saveActivityProgress(value: ActivityProgressDocument) { if (!db) throw new Error('firebase-not-configured'); await setDoc(doc(db, progressDocumentPath(value.academicYear, value.classId)), { ...value, serverUpdatedAt: serverTimestamp() }, { merge: false }) }
export async function resetActivityProgress(year: string, classId: string) { if (!db) throw new Error('firebase-not-configured'); await deleteDoc(doc(db, progressDocumentPath(year, classId))) }
