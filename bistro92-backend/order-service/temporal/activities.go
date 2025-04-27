package temporal

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	_ "github.com/lib/pq"
	"github.com/streadway/amqp"
)

var db *sql.DB

func InitDB() error {
	var err error
	db, err = sql.Open("postgres", "postgres://postgres:secret@localhost:5432/bistro92?sslmode=disable")
	return err
}

func StoreOrder(ctx context.Context, order Order) error {
	// Start a transaction
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// First check if the table exists
	var exists bool
	err = tx.QueryRowContext(
		ctx,
		"SELECT EXISTS(SELECT 1 FROM tables WHERE number = $1)",
		order.TableNumber,
	).Scan(&exists)

	if err != nil {
		return err
	}

	if !exists {
		// If table doesn't exist, create it first
		_, err = tx.ExecContext(
			ctx,
			"INSERT INTO tables (number, status) VALUES ($1, 'Occupied')",
			order.TableNumber,
		)
		if err != nil {
			return err
		}
	} else {
		// If table exists, update its status to 'Occupied'
		_, err = tx.ExecContext(
			ctx,
			"UPDATE tables SET status = 'Occupied' WHERE number = $1",
			order.TableNumber,
		)
		if err != nil {
			return err
		}
	}

	// Calculate total amount
	var totalAmount float64
	for _, item := range order.Items {
		totalAmount += item.Price * float64(item.Quantity)
	}

	// Now insert the order
	itemsJSON, err := json.Marshal(order.Items)
	if err != nil {
		return err
	}

	var orderID int
	err = tx.QueryRowContext(
		ctx,
		`INSERT INTO orders (table_number, items, status, total_amount) 
		 VALUES ($1, $2, $3, $4) RETURNING id`,
		order.TableNumber,
		itemsJSON,
		"Pending",
		totalAmount,
	).Scan(&orderID)

	if err != nil {
		return err
	}

	// Insert notification for new order
	message := fmt.Sprintf("New order received for table %d", order.TableNumber)
	_, err = tx.ExecContext(
		ctx,
		`INSERT INTO notifications (order_id, notification_type, message)
		 VALUES ($1, $2, $3)`,
		orderID,
		"new_order",
		message,
	)
	if err != nil {
		return err
	}

	// Commit transaction
	return tx.Commit()
}

func UpdateOrderStatus(ctx context.Context, orderID int, status string, chefName string) error {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Update status only, ignore chefName
	result, err := tx.ExecContext(
		ctx,
		"UPDATE orders SET status = $1 WHERE id = $2",
		status, orderID,
	)

	if err != nil {
		return err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if rowsAffected == 0 {
		return fmt.Errorf("order with ID %d not found", orderID)
	}

	// If completed, update table status to Available
	if status == "Completed" {
		_, err = tx.ExecContext(
			ctx,
			`UPDATE tables t
			 SET status = 'Available'
			 FROM orders o
			 WHERE o.id = $1 AND t.number = o.table_number`,
			orderID,
		)
		if err != nil {
			return err
		}
	}

	// Record notification for status change
	_, err = tx.ExecContext(
		ctx,
		"INSERT INTO notifications (order_id, notification_type, message) VALUES ($1, $2, $3)",
		orderID, "status_change", fmt.Sprintf("Order #%d status changed to %s", orderID, status),
	)
	if err != nil {
		return err
	}

	return tx.Commit()
}

func GetOrder(ctx context.Context, orderID int) (*Order, error) {
	var tableNumber int
	var itemsJSON []byte
	var status string
	var assignedTo sql.NullString // Kept for backward compatibility but not used

	err := db.QueryRowContext(
		ctx,
		`SELECT table_number, items, status, assigned_to
		 FROM orders WHERE id = $1`,
		orderID,
	).Scan(&tableNumber, &itemsJSON, &status, &assignedTo)

	if err != nil {
		return nil, err
	}

	var items []OrderItem
	err = json.Unmarshal(itemsJSON, &items)
	if err != nil {
		return nil, err
	}

	order := &Order{
		ID:          orderID,
		TableNumber: tableNumber,
		Items:       items,
		Status:      status,
	}

	return order, nil
}

func GetOrders(ctx context.Context, status string) ([]Order, error) {
	var query string
	var rows *sql.Rows
	var err error

	if status == "" {
		query = `SELECT id, table_number, items, status, assigned_to, order_time
				 FROM orders ORDER BY order_time DESC`
		rows, err = db.QueryContext(ctx, query)
	} else {
		query = `SELECT id, table_number, items, status, assigned_to, order_time
				 FROM orders WHERE status = $1 ORDER BY order_time DESC`
		rows, err = db.QueryContext(ctx, query, status)
	}

	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var orders []Order
	for rows.Next() {
		var id int
		var tableNumber int
		var itemsJSON []byte
		var status string
		var assignedTo sql.NullString // Kept for backward compatibility but not used
		var orderTime time.Time

		err := rows.Scan(&id, &tableNumber, &itemsJSON, &status, &assignedTo, &orderTime)
		if err != nil {
			return nil, err
		}

		var items []OrderItem
		err = json.Unmarshal(itemsJSON, &items)
		if err != nil {
			return nil, err
		}

		order := Order{
			ID:          id,
			TableNumber: tableNumber,
			Items:       items,
			Status:      status,
			OrderTime:   orderTime,
		}

		orders = append(orders, order)
	}

	return orders, nil
}

func DeleteOrder(ctx context.Context, orderID int) error {
	// Start a transaction
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Delete notifications first due to foreign key constraint
	_, err = tx.ExecContext(
		ctx,
		"DELETE FROM notifications WHERE order_id = $1",
		orderID,
	)
	if err != nil {
		return err
	}

	// Delete the order
	_, err = tx.ExecContext(
		ctx,
		"DELETE FROM orders WHERE id = $1",
		orderID,
	)
	if err != nil {
		return err
	}

	// Commit transaction
	return tx.Commit()
}

func PublishOrderEvent(ctx context.Context, order Order) error {
	conn, err := amqp.Dial("amqp://guest:guest@localhost:5672/")
	if err != nil {
		return err
	}
	defer conn.Close()

	ch, err := conn.Channel()
	if err != nil {
		return err
	}
	defer ch.Close()

	q, err := ch.QueueDeclare("order.created", true, false, false, false, nil)
	if err != nil {
		return err
	}

	// Include more order details in the message
	type OrderNotification struct {
		ID          int         `json:"id"`
		TableNumber int         `json:"table_number"`
		Items       []OrderItem `json:"items"`
		Status      string      `json:"status"`
		Timestamp   string      `json:"timestamp"`
	}

	notification := OrderNotification{
		ID:          order.ID,
		TableNumber: order.TableNumber,
		Items:       order.Items,
		Status:      order.Status,
		Timestamp:   time.Now().Format(time.RFC3339),
	}

	body, err := json.Marshal(notification)
	if err != nil {
		return err
	}

	return ch.Publish("", q.Name, false, false, amqp.Publishing{
		ContentType:  "application/json",
		Body:         body,
		DeliveryMode: amqp.Persistent,
	})
}

func GetDB() (*sql.DB, error) {
	if db == nil {
		return nil, fmt.Errorf("database not initialized")
	}
	return db, nil
}
