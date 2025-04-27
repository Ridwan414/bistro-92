package temporal

import (
	"time"

	"go.temporal.io/sdk/temporal"
	"go.temporal.io/sdk/workflow"
)

type Order struct {
	ID          int
	TableNumber int
	Items       []OrderItem
	Status      string
	OrderTime   time.Time
}

type OrderItem struct {
	ItemID   int
	Name     string
	Quantity int
	Price    float64
}

func OrderWorkflow(ctx workflow.Context, order Order) error {
	ctx = workflow.WithActivityOptions(ctx, workflow.ActivityOptions{
		StartToCloseTimeout: time.Minute,
		RetryPolicy:         &temporal.RetryPolicy{MaximumAttempts: 3},
	})

	err := workflow.ExecuteActivity(ctx, StoreOrder, order).Get(ctx, nil)
	if err != nil {
		return err
	}

	err = workflow.ExecuteActivity(ctx, PublishOrderEvent, order).Get(ctx, nil)
	if err != nil {
		return err
	}

	return nil
}

// Status change workflow
func UpdateOrderStatusWorkflow(ctx workflow.Context, orderID int, status string) error {
	ctx = workflow.WithActivityOptions(ctx, workflow.ActivityOptions{
		StartToCloseTimeout: time.Minute,
		RetryPolicy:         &temporal.RetryPolicy{MaximumAttempts: 3},
	})

	// Update order status in database
	err := workflow.ExecuteActivity(ctx, UpdateOrderStatus, orderID, status, "").Get(ctx, nil)
	if err != nil {
		return err
	}

	// Get the updated order to publish
	var order *Order
	err = workflow.ExecuteActivity(ctx, GetOrder, orderID).Get(ctx, &order)
	if err != nil {
		return err
	}

	// Publish notification about status change
	err = workflow.ExecuteActivity(ctx, PublishOrderEvent, *order).Get(ctx, nil)
	if err != nil {
		return err
	}

	return nil
}
