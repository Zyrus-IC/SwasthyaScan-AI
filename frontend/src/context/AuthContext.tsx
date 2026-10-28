import React, { createContext, useContext, useState, useEffect } from 'react'

export interface UserProfile {
  id: string
  identifier: string
  email: string
  username?: string | null
  type?: 'phone' | 'email' | string
  maskedIdentifier: string
  createdAt: string
  needsUsername?: boolean
}

interface AuthContextType {
  user: UserProfile | null
  token: string | null
  isAuthenticated: boolean
  loading: boolean
  sendOtp: (identifier: string) => Promise<{ success: boolean; message: string; dev_otp?: string }>
  verifyOtp: (identifier: string, code: string) => Promise<{ success: boolean; message: string; needs_username?: boolean }>
  loginWithPassword: (usernameOrEmail: string, password: string) => Promise<{ success: boolean; message: string }>
  setProfile: (username: string, password?: string) => Promise<{ success: boolean; message: string }>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const TOKEN_KEY = 'swasthyascan_auth_token'
const USER_KEY  = 'swasthyascan_auth_user'

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY))
  const [user, setUser]   = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem(USER_KEY)
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })
  const [loading, setLoading] = useState<boolean>(true)

  // Verify session on initial mount
  useEffect(() => {
    const verifySession = async () => {
      const storedToken = localStorage.getItem(TOKEN_KEY)
      if (!storedToken) {
        setLoading(false)
        return
      }

      try {
        const res = await fetch('/api/auth/me', {
          headers: {
            'Authorization': `Bearer ${storedToken}`,
          },
          signal: AbortSignal.timeout(4000),
        })

        if (res.ok) {
          const profile = await res.json() as UserProfile
          setUser(profile)
          localStorage.setItem(USER_KEY, JSON.stringify(profile))
        } else {
          // Token expired or invalid
          setToken(null)
          setUser(null)
          localStorage.removeItem(TOKEN_KEY)
          localStorage.removeItem(USER_KEY)
        }
      } catch {
        // Fall back to stored user if offline / transient failure
      } finally {
        setLoading(false)
      }
    }

    verifySession()
  }, [])

  const sendOtp = async (identifier: string) => {
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'email', identifier }),
      })

      const data = await res.json()
      if (!res.ok) {
        return { success: false, message: data.detail || 'Failed to send verification code.' }
      }

      return {
        success: true,
        message: data.message,
        dev_otp: data.dev_otp,
      }
    } catch (err) {
      return {
        success: false,
        message: 'Network error. Please make sure the backend server is reachable.',
      }
    }
  }

  const verifyOtp = async (identifier: string, code: string) => {
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'email', identifier, code }),
      })

      const data = await res.json()
      if (!res.ok) {
        return { success: false, message: data.detail || 'Invalid verification code.' }
      }

      const receivedToken = data.token as string
      const receivedUser  = data.user as UserProfile

      setToken(receivedToken)
      setUser(receivedUser)

      localStorage.setItem(TOKEN_KEY, receivedToken)
      localStorage.setItem(USER_KEY, JSON.stringify(receivedUser))

      return {
        success: true,
        message: data.message,
        needs_username: data.needs_username ?? receivedUser.needsUsername ?? false,
      }
    } catch (err) {
      return {
        success: false,
        message: 'Network error during verification. Please try again.',
      }
    }
  }

  const loginWithPassword = async (usernameOrEmail: string, password: string) => {
    try {
      const res = await fetch('/api/auth/login-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username_or_email: usernameOrEmail, password }),
      })

      const data = await res.json()
      if (!res.ok) {
        return { success: false, message: data.detail || 'Sign in failed.' }
      }

      const receivedToken = data.token as string
      const receivedUser  = data.user as UserProfile

      setToken(receivedToken)
      setUser(receivedUser)

      localStorage.setItem(TOKEN_KEY, receivedToken)
      localStorage.setItem(USER_KEY, JSON.stringify(receivedUser))

      return { success: true, message: data.message }
    } catch (err) {
      return {
        success: false,
        message: 'Network error during login. Please try again.',
      }
    }
  }

  const setProfile = async (username: string, password?: string) => {
    try {
      const currentToken = token || localStorage.getItem(TOKEN_KEY)
      if (!currentToken) {
        return { success: false, message: 'Not authenticated. Please sign in.' }
      }

      const res = await fetch('/api/auth/set-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentToken}`,
        },
        body: JSON.stringify({ username, password: password || null }),
      })

      const data = await res.json()
      if (!res.ok) {
        return { success: false, message: data.detail || 'Failed to update username.' }
      }

      const updatedUser = data as UserProfile
      setUser(updatedUser)
      localStorage.setItem(USER_KEY, JSON.stringify(updatedUser))

      return { success: true, message: 'Username saved successfully!' }
    } catch (err) {
      return {
        success: false,
        message: 'Network error while updating username.',
      }
    }
  }

  const logout = async () => {
    try {
      if (token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
        })
      }
    } catch {
      // Ignore network errors on logout
    } finally {
      setToken(null)
      setUser(null)
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
    }
  }

  const isAuthenticated = Boolean(token && user)

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated,
        loading,
        sendOtp,
        verifyOtp,
        loginWithPassword,
        setProfile,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return ctx
}
