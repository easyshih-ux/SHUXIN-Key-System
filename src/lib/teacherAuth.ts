import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from './firebase'

export interface TeacherIdentity {
  uid: string
  displayName: string | null
  email: string | null
  photoURL: string | null
}

export type TeacherAuthSnapshot =
  | { status: 'loading'; teacher: null; error: null }
  | { status: 'signed-out'; teacher: null; error: null }
  | { status: 'checking'; teacher: TeacherIdentity; error: null }
  | { status: 'authorized'; teacher: TeacherIdentity; error: null }
  | { status: 'unauthorized'; teacher: TeacherIdentity; error: null }
  | { status: 'error'; teacher: TeacherIdentity | null; error: string }

export const teacherIdentityFromUser = (user: Pick<User, 'uid' | 'displayName' | 'email' | 'photoURL'>): TeacherIdentity => ({
  uid: user.uid,
  displayName: user.displayName,
  email: user.email,
  photoURL: user.photoURL,
})

export async function isAuthorizedTeacher(uid: string) {
  if (!db) throw new Error('firebase-not-configured')
  return (await getDoc(doc(db, 'authorizedTeachers', uid))).exists()
}

export function observeTeacherAuth(onChange: (snapshot: TeacherAuthSnapshot) => void) {
  onChange({ status: 'loading', teacher: null, error: null })
  if (!auth) {
    onChange({ status: 'error', teacher: null, error: 'Firebase 尚未完成設定。' })
    return () => undefined
  }
  return onAuthStateChanged(auth, async (user) => {
    if (!user) { onChange({ status: 'signed-out', teacher: null, error: null }); return }
    const teacher = teacherIdentityFromUser(user)
    onChange({ status: 'checking', teacher, error: null })
    try {
      onChange({ status: await isAuthorizedTeacher(user.uid) ? 'authorized' : 'unauthorized', teacher, error: null })
    } catch {
      onChange({ status: 'error', teacher, error: '無法確認館員權限，請檢查網路或 Firestore Rules。' })
    }
  }, () => onChange({ status: 'error', teacher: null, error: '無法恢復 Google 登入狀態。' }))
}

export async function signInTeacher() {
  if (!auth) throw new Error('firebase-not-configured')
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })
  return teacherIdentityFromUser((await signInWithPopup(auth, provider)).user)
}

export async function signOutTeacher() {
  if (!auth) throw new Error('firebase-not-configured')
  await signOut(auth)
}