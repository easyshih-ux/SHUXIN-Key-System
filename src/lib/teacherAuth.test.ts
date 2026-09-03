import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: { name: 'auth' },
  db: { name: 'db' },
  onAuthStateChanged: vi.fn(),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
  getDoc: vi.fn(),
  doc: vi.fn((_db, collection, uid) => `${collection}/${uid}`),
}))

vi.mock('./firebase', () => ({ auth: mocks.auth, db: mocks.db }))
vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: class { setCustomParameters = vi.fn() },
  onAuthStateChanged: mocks.onAuthStateChanged,
  signInWithPopup: mocks.signInWithPopup,
  signOut: mocks.signOut,
}))
vi.mock('firebase/firestore', () => ({ doc: mocks.doc, getDoc: mocks.getDoc }))

import { observeTeacherAuth, signInTeacher, signOutTeacher, teacherIdentityFromUser, type TeacherAuthSnapshot } from './teacherAuth'

const user = { uid: 'teacher-uid', displayName: '館員老師', email: 'teacher@example.edu', photoURL: 'https://example.edu/photo.jpg' }
const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

beforeEach(() => vi.clearAllMocks())

describe('teacher authentication', () => {
  it('exposes all required identity fields', () => expect(teacherIdentityFromUser(user)).toEqual(user))
  it('reports loading then signed-out through the auth observer', () => {
    mocks.onAuthStateChanged.mockImplementation((_auth, next) => { next(null); return vi.fn() })
    const states: TeacherAuthSnapshot[] = []
    observeTeacherAuth((state) => states.push(state))
    expect(states.map((state) => state.status)).toEqual(['loading', 'signed-out'])
  })
  it('reports an authorized teacher', async () => {
    mocks.getDoc.mockResolvedValue({ exists: () => true })
    mocks.onAuthStateChanged.mockImplementation((_auth, next) => { void next(user); return vi.fn() })
    const states: TeacherAuthSnapshot[] = []
    observeTeacherAuth((state) => states.push(state))
    await flush()
    expect(states.map((state) => state.status)).toEqual(['loading', 'checking', 'authorized'])
    expect(mocks.doc).toHaveBeenCalledWith(mocks.db, 'authorizedTeachers', 'teacher-uid')
  })
  it('reports an unauthorized teacher and retains the UID', async () => {
    mocks.getDoc.mockResolvedValue({ exists: () => false })
    mocks.onAuthStateChanged.mockImplementation((_auth, next) => { void next(user); return vi.fn() })
    const states: TeacherAuthSnapshot[] = []
    observeTeacherAuth((state) => states.push(state))
    await flush()
    expect(states.at(-1)).toMatchObject({ status: 'unauthorized', teacher: { uid: 'teacher-uid' } })
  })
  it('handles a permission failure without throwing from the observer', async () => {
    mocks.getDoc.mockRejectedValue(new Error('permission-denied'))
    mocks.onAuthStateChanged.mockImplementation((_auth, next) => { void next(user); return vi.fn() })
    const states: TeacherAuthSnapshot[] = []
    observeTeacherAuth((state) => states.push(state))
    await flush()
    expect(states.at(-1)).toMatchObject({ status: 'error', teacher: { uid: 'teacher-uid' } })
  })
  it('signs in with Google and signs out from the shared auth instance', async () => {
    mocks.signInWithPopup.mockResolvedValue({ user })
    mocks.signOut.mockResolvedValue(undefined)
    await expect(signInTeacher()).resolves.toEqual(user)
    await signOutTeacher()
    expect(mocks.signInWithPopup).toHaveBeenCalledWith(mocks.auth, expect.anything())
    expect(mocks.signOut).toHaveBeenCalledWith(mocks.auth)
  })
})