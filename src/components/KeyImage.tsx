import { useState } from 'react'
import { KEY_IMAGE_BY_LEVEL } from '../config/keyAssets'
import type { KeyLevel } from '../config/keyLevels'

interface KeyImageProps {
  level: KeyLevel
  className?: string
  alt?: string
}

export function KeyImage({ level, className = '', alt = '' }: KeyImageProps) {
  const [failed, setFailed] = useState(false)
  if (failed) return <span className={`key-image-error ${className}`} role="img" aria-label="鑰匙素材載入失敗">鑰匙素材載入失敗</span>
  return <img className={`key-image ${className}`} src={KEY_IMAGE_BY_LEVEL[level]} alt={alt} draggable={false} onError={() => setFailed(true)} />
}
