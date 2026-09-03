import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

describe('Firebase initialization architecture', () => {
  it('initializes one default app and derives Firestore and Auth from it', () => {
    const source = readFileSync(new URL('./firebase.ts', import.meta.url), 'utf8')
    expect(source.match(/initializeApp\(/g)).toHaveLength(1)
    expect(source).toContain('getFirestore(firebaseApp)')
    expect(source).toContain('getAuth(firebaseApp)')
    expect(source).toContain("SHUXIN_FIREBASE_PROJECT_ID = 'shuxin-key-system'")
    expect(source).not.toContain("'shuxin-progress'")
  })
  it('keeps repository initialization-free', () => {
    const source = readFileSync(new URL('./activityProgress.ts', import.meta.url), 'utf8')
    expect(source).not.toContain('initializeApp')
    expect(source).toContain("import { db } from './firebase'")
  })
})
