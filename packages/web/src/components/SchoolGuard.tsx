import React from 'react'
import { Role } from '../types'

const SUPER_ROLES: Role[] = ['Ami', 'Super Admin', 'Owner']

export const SchoolGuard = ({ role }: { role?: Role }) => {
  const r = role
  if (!r || !SUPER_ROLES.includes(r)) return null

  return (
    <div className="h-64 flex items-center justify-center">
      <div className="text-center p-6 bg-[#151619] rounded-2xl border border-white/5 max-w-md">
        <h3 className="text-lg font-bold text-white">Access Restricted</h3>
        <p className="text-zinc-400 mt-2">You are currently using a global/system role ({r}). School dashboards and data are restricted for this role to prevent accidental access.</p>
      </div>
    </div>
  )
}

export function isSuperRole(role?: Role) {
  if (!role) return false
  return SUPER_ROLES.includes(role)
}
