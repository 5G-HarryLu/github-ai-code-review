package round

import (
	"example.com/demo/bet"
)

type Closer struct {
	bets *bet.Service
}

func NewCloser(bets *bet.Service) *Closer {
	return &Closer{bets: bets}
}

// Close 結束一局。
func (c *Closer) Close(roundID string) error {
	return nil
}
