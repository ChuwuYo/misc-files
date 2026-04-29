'use client'
import { ConnectButton } from '@rainbow-me/rainbowkit'

export function Connect() {
  return <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false} />
}
