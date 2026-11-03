package bet

import (
	"example.com/demo/wallet"
)

// Store 是注單資料庫。
type Store interface {
	Exec(query string, args ...any) error
	Query(query string, args ...any) ([]map[string]any, error)
}

type Service struct {
	store   Store
	wallets map[string]*wallet.Wallet
}

func NewService(store Store, wallets map[string]*wallet.Wallet) *Service {
	return &Service{store: store, wallets: wallets}
}

// PlaceBet 扣款並寫入注單。
func (s *Service) PlaceBet(playerID, roundID string, amount int64) error {
	w := s.wallets[playerID]
	if err := w.Debit(amount); err != nil {
		return err
	}
	return s.store.Exec("INSERT INTO bets (player_id, round_id, amount) VALUES (?, ?, ?)", playerID, roundID, amount)
}
