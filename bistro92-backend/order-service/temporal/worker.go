package temporal

import (
	"go.temporal.io/sdk/client"
	"go.temporal.io/sdk/worker"
)

func StartWorker(c client.Client) error {
	w := worker.New(c, "order-queue", worker.Options{})

	// Register workflows
	w.RegisterWorkflow(OrderWorkflow)
	w.RegisterWorkflow(UpdateOrderStatusWorkflow)

	// Register activities
	w.RegisterActivity(StoreOrder)
	w.RegisterActivity(PublishOrderEvent)
	w.RegisterActivity(UpdateOrderStatus)
	w.RegisterActivity(GetOrder)
	w.RegisterActivity(GetOrders)
	w.RegisterActivity(DeleteOrder)

	return w.Run(worker.InterruptCh())
}
