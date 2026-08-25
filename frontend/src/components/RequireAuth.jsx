import { Navigate, useLocation } from 'react-router-dom'

import { useAuthStore } from '../store/auth'

export default function RequireAuth({ children, roles }) {
  const { accessToken, user } = useAuthStore()
  const location = useLocation()

  if (!accessToken || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }
  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" replace />
  }
  return children
}
