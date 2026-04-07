package main

import (
	"fmt"
	"sync"
)

// SharedState - 共享狀態，故意不加鎖
type SharedState struct {
	Data    map[string]int
	Counter int
	Items   []string
}

var globalState = &SharedState{
	Data:    make(map[string]int),
	Counter: 0,
	Items:   []string{},
}

// ProcessOrder - 故意的 race condition：reference type 沒有保護
func ProcessOrder(state *SharedState, orderID string) {
	// 讀取 counter
	current := state.Counter

	// ❌ 中間做了其他事情，這段時間 state.Counter 可能被其他 goroutine 改了
	fmt.Printf("Processing order %s, current counter: %d\n", orderID, current)
	doSomeWork()

	// 使用之前讀取的 counter，但值可能已經過時了
	state.Counter = current + 1
	state.Data[orderID] = current
}

// UpdateItems - 故意的 slice reference 問題
func UpdateItems(state *SharedState) {
	// ❌ 這不是真正的複製！底層 array 是共享的
	items := state.Items

	// 修改 items 會影響原始的 state.Items
	items = append(items, "new-item")
	fmt.Println("Items:", items)
}

// ConcurrentAccess - 多個 goroutine 同時存取沒有鎖保護的 map
func ConcurrentAccess() {
	var wg sync.WaitGroup

	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			// ❌ 沒有 mutex 保護的 map 並發寫入 = fatal error
			globalState.Data[fmt.Sprintf("key-%d", id)] = id
		}(i)
	}

	wg.Wait()
}

func doSomeWork() {
	// simulate work
}

func main() {
	go ProcessOrder(globalState, "order-1")
	go ProcessOrder(globalState, "order-2")
	go ProcessOrder(globalState, "order-3")
	ConcurrentAccess()
}
