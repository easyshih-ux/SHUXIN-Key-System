import { getApps, initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app'
import { getFirestore, type Firestore } from 'firebase/firestore'
import { getAuth, type Auth } from 'firebase/auth'

export const SHUXIN_FIREBASE_PROJECT_ID = 'shuxin-key-system'

const firebaseConfig: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId)

function initializeShuxinFirebase(): FirebaseApp | null {
  if (!isFirebaseConfigured) return null
  if (firebaseConfig.projectId !== SHUXIN_FIREBASE_PROJECT_ID) throw new Error('Refusing to initialize a non-SHUXIN Firebase project')
  const existingDefaultApp = getApps().find((candidate) => candidate.name === '[DEFAULT]')
  if (existingDefaultApp) {
    if (existingDefaultApp.options.projectId !== firebaseConfig.projectId) throw new Error('SHUXIN Firebase projectId does not match the existing default app')
    return existingDefaultApp
  }
  return initializeApp(firebaseConfig)
}

export const firebaseApp = initializeShuxinFirebase()
export const db: Firestore | null = firebaseApp ? getFirestore(firebaseApp) : null
export const auth: Auth | null = firebaseApp ? getAuth(firebaseApp) : null
