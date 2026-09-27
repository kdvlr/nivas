import type { ReactNode } from 'react'

/** Shared wrapping and spacing; pages retain their own meaningful controls. */
export default function PageHeader({ children }: { children: ReactNode }) {
  return <header className="page-header">{children}</header>
}
