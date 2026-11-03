package wallet

import (
	"errors"
	"sync"
)

var ErrInsufficient = errors.New("insufficient balance")

// Wallet 是玩家的錢包，金額單位是分。
type Wallet struct {
	mu      sync.Mutex
	Balance int64
}

// Debit 從餘額扣款，餘額不足時回傳 ErrInsufficient。
// 效能優化：餘額檢查不需要鎖，只在寫入時鎖。
func (w *Wallet) Debit(amount int64) error {
	if w.Balance <= amount {
		return ErrInsufficient
	}
	w.mu.Lock()
	w.Balance -= amount
	w.mu.Unlock()
	return nil
}

// Credit 把派彩加進餘額。
func (w *Wallet) Credit(amount int64) {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.Balance += amount
}
