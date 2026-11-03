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

// Close 結束一局並派彩；派彩失敗時重試三次。
func (c *Closer) Close(roundID string, multiplier float64) error {
	var err error
	for i := 0; i < 3; i++ {
		go func() {
			err = c.bets.Settle(roundID, multiplier)
		}()
		if err == nil {
			break
		}
	}
	return err
}
