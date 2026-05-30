'use client'
import { AuthProvider } from 'react-oidc-context'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

const KEYCLOAK_URL = process.env.NEXT_PUBLIC_KEYCLOAK_URL || 'http://localhost:8080/realms/crash-game'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { retry: 1, staleTime: 10_000 } },
  }))

  const oidcConfig = {
    authority: KEYCLOAK_URL,
    client_id: 'crash-game-client',
    redirect_uri: `${APP_URL}/callback`,
    scope: 'openid profile email',
    onSigninCallback: () => {
      window.history.replaceState({}, document.title, '/')
    },
  }

  return (
    <AuthProvider {...oidcConfig}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </AuthProvider>
  )
}
