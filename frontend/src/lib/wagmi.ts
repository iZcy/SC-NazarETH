import { createConfig, http } from 'wagmi'
import { foundry } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'

export const config = createConfig({
  chains: [foundry],
  connectors: [injected()],
  transports: {
    [foundry.id]: http('http://localhost:8545'),
  },
})

declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
}
