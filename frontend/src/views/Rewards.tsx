import { useState } from 'react'
import CoinIcon from '../components/CoinIcon'
import Icon from '../components/Icon'
import { api } from '../lib/api'
import { useData } from '../lib/hooks'
import type { CoinBalance, RewardStoreItem, RewardRedemptionItem, CoinTransaction } from '../lib/types'
import { useRewardCelebration } from '../components/celebrations/RewardCelebrationContext'

function timeAgo(dateStr: string) {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = Math.max(0, now - then)
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

export default function Rewards() {
  const { data: balances, reload: reloadBalances } = useData<CoinBalance[]>('/api/rewards/balances', ['rewards', 'chores'])
  const { data: store } = useData<RewardStoreItem[]>('/api/rewards/store', ['rewards'])
  const { data: history, reload: reloadHistory } = useData<RewardRedemptionItem[]>('/api/rewards/history', ['rewards'])
  const { data: transactions } = useData<CoinTransaction[]>('/api/rewards/transactions', ['rewards', 'chores'])
  const { celebrateReward } = useRewardCelebration()
  const [redeemingId, setRedeemingId] = useState<string | null>(null)

  const redeem = async (personName: string, rewardItemId: number) => {
    const key = `${personName}-${rewardItemId}`
    setRedeemingId(key)
    try {
      await api.post('/api/rewards/redeem', { person_name: personName, reward_item_id: rewardItemId })
      celebrateReward()
      reloadBalances()
      reloadHistory()
    } catch {
      // Insufficient balance or other error
    } finally {
      setRedeemingId(null)
    }
  }

  const items = store ?? []
  const redemptions = history ?? []
  const bals = balances ?? []
  const txns = transactions ?? []

  return (
    <div className="flex h-full flex-col p-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <button
          onClick={() => (location.hash = '#/chores')}
          className="text-lg font-medium text-ink-soft transition-colors hover:text-ink"
        >
          <Icon name="arrow_back" /> Back to Chores
        </button>
        <h1 className="text-3xl font-semibold tracking-tight text-ink"><Icon name="storefront" /> Rewards Store</h1>
      </div>

      {/* Coin Balances */}
      <div className="mb-8 flex flex-wrap gap-4">
        {bals.map((b) => (
          <div
            key={b.person_name}
            className="flex min-w-[200px] flex-col items-center glass-inset p-5"
          >
            <div className="mb-2 flex items-center gap-2">
              <span className="h-4 w-4 rounded-full" style={{ background: b.color }} />
              <span className="text-xl font-medium">{b.person_name}</span>
            </div>
            <span className="text-3xl font-semibold tracking-tight text-ink text-amber-500"><CoinIcon /> {b.balance}</span>
            <span className="mt-1 text-sm text-ink-soft">
              earned {b.earned}
              {b.lost > 0 && (
                <span className="text-rose-400"> · lost {b.lost}</span>
              )}
              {' '}· spent {b.spent}
            </span>
          </div>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-8 overflow-y-auto pb-6 lg:grid-cols-3">
        {/* Available Rewards */}
        <section className="lg:col-span-1">
          <h2 className="mb-4 text-2xl font-medium">Available Rewards</h2>
          {items.length === 0 ? (
            <p className="text-lg text-ink-soft">No rewards set up yet — add some in Setup!</p>
          ) : (
            <div className="flex flex-col gap-4">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col items-center glass-inset p-5"
                >
                  <span className="mb-2 text-5xl">{item.emoji}</span>
                  <span className="mb-1 text-center text-lg font-medium">{item.title}</span>
                  <span className="mb-3 font-medium text-amber-500"><CoinIcon /> ×{item.coin_cost}</span>
                  <div className="flex flex-wrap justify-center gap-2">
                    {bals.map((b) => {
                      const key = `${b.person_name}-${item.id}`
                      const canAfford = b.balance >= item.coin_cost
                      return (
                        <button
                          key={b.person_name}
                          disabled={!canAfford || redeemingId === key}
                          onClick={() => redeem(b.person_name, item.id)}
                          className="rounded-full px-3 py-1.5 text-sm font-medium text-white transition-all disabled:opacity-30"
                          style={{ background: b.color }}
                          title={canAfford ? `Redeem for ${b.person_name}` : `${b.person_name} needs ${item.coin_cost - b.balance} more coins`}
                        >
                          {b.person_name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Recent Redemptions */}
        <section>
          <h2 className="mb-4 text-2xl font-medium">Recent Redemptions</h2>
          {redemptions.length === 0 ? (
            <p className="text-lg text-ink-soft">No redemptions yet — earn some coins! <CoinIcon /></p>
          ) : (
            <div className="flex flex-col">
              {redemptions.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center gap-3 border-b border-[var(--outline-var)] py-3 text-lg"
                >
                  <span className="text-2xl">{r.reward_emoji}</span>
                  <span className="flex-1">
                    <span className="font-medium">{r.person_name}</span>{' '}
                    redeemed{' '}
                    <span className="font-medium">{r.reward_title}</span>
                    <span className="ml-2 text-sm font-medium text-amber-500">-<CoinIcon /> {r.coins_spent}</span>
                  </span>
                  <span className="text-sm text-ink-soft">{timeAgo(r.redeemed_at)}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Transaction History */}
        <section>
          <h2 className="mb-4 text-2xl font-medium">Transaction History</h2>
          {txns.length === 0 ? (
            <p className="text-lg text-ink-soft">No transactions yet.</p>
          ) : (
            <div className="flex flex-col">
              {txns.map((tx) => {
                const isPositive = tx.amount > 0
                return (
                  <div
                    key={tx.id}
                    className="flex items-center gap-3 border-b border-[var(--outline-var)] py-3 text-base"
                  >
                    <span
                      className={`text-lg font-medium ${isPositive ? 'text-emerald-500' : 'text-rose-500'}`}
                    >
                      {isPositive ? '+' : ''}{tx.amount} <CoinIcon />
                    </span>
                    <span className="flex-1">
                      <span className="font-medium">{tx.person_name}</span>{' '}
                      <span className="text-ink-soft">
                        {tx.reason === 'chore_completed' && '— chore completed'}
                        {tx.reason === 'chore_missed' && '— chore missed'}
                        {tx.reason === 'reward_redeemed' && '— reward redeemed'}
                        {!['chore_completed', 'chore_missed', 'reward_redeemed'].includes(tx.reason) && `— ${tx.reason}`}
                      </span>
                    </span>
                    <span className="text-sm text-ink-soft">{timeAgo(tx.created_at)}</span>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
